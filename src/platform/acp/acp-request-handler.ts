import * as vscode from 'vscode';
import { ACPClient } from './acp-client';
import {
    AgentMessageContent,
    ToolCall,
    ToolCallKind,
    ToolCallStatus,
    PermissionRequest,
    PermissionResponse,
    AgentPlan,
    PromptRequest,
} from './types';

/**
 * Handles ACP requests and streams responses to VS Code chat UI
 */
export class ACPRequestHandler {
    private onPermissionRequest?: (request: PermissionRequest) => Promise<boolean>;
    private handleAgentMessageBound: (content: AgentMessageContent) => void;
    private handleToolCallBound: (toolCall: ToolCall) => Promise<void>;
    private handlePermissionRequestBound: (request: PermissionRequest) => Promise<PermissionResponse>;
    private handleAgentPlanBound: (plan: AgentPlan) => void;

    constructor(
        private acpClient: ACPClient,
        private stream: vscode.ChatResponseStream,
        private token: vscode.CancellationToken
    ) {
        // Bind event handlers
        this.handleAgentMessageBound = this.handleAgentMessage.bind(this);
        this.handleToolCallBound = this.handleToolCall.bind(this);
        this.handlePermissionRequestBound = this.handlePermissionRequest.bind(this);
        this.handleAgentPlanBound = this.handleAgentPlan.bind(this);

        // Register event listeners
        this.acpClient.on('agent_message', this.handleAgentMessageBound);
        this.acpClient.on('tool_call', this.handleToolCallBound);
        this.acpClient.on('permission_request', this.handlePermissionRequestBound);
        this.acpClient.on('agent_plan', this.handleAgentPlanBound);
    }

    /**
     * Handle a chat request by sending it to the ACP agent
     */
    async handleRequest(
        prompt: string,
        references: vscode.ChatPromptReference[]
    ): Promise<vscode.ChatResult> {
        try {
            // Check for cancellation
            if (this.token.isCancellationRequested) {
                return {
                    errorDetails: {
                        message: 'Request cancelled',
                    },
                    metadata: {
                        command: undefined,
                    },
                };
            }

            // Build content blocks
            const content: any[] = [
                {
                    type: 'text',
                    text: prompt,
                },
            ];

            // Add references as embedded resources
            for (const ref of references) {
                if (ref.value && 'uri' in ref.value) {
                    content.push({
                        type: 'embedded_resource',
                        resource: {
                            type: 'file',
                            uri: ref.id,
                        },
                    });
                }
            }

            // Send prompt to ACP agent
            const request: PromptRequest = {
                messages: [
                    {
                        role: 'user',
                        content,
                    },
                ],
            };

            await this.acpClient.prompt(request);

            return {
                metadata: {
                    command: undefined,
                },
            };
        } catch (error) {
            return {
                errorDetails: {
                    message: error instanceof Error ? error.message : String(error),
                },
                metadata: {
                    command: undefined,
                },
            };
        }
    }

    /**
     * Handle agent message content
     */
    private handleAgentMessage(content: AgentMessageContent): void {
        switch (content.type) {
            case 'text':
                this.stream.markdown(content.text);
                break;

            case 'thinking':
                this.stream.progress(`💭 ${content.thinking}`);
                break;

            case 'image':
                const imageMarkdown = `![Image](data:${content.mimeType};base64,${content.data})`;
                this.stream.markdown(imageMarkdown);
                break;

            case 'embedded_resource':
                // Create a reference to the embedded resource
                if (content.resource.type === 'file') {
                    const uri = vscode.Uri.parse(content.resource.uri);
                    this.stream.reference(uri);
                }
                break;
        }
    }

    /**
     * Handle tool call updates
     */
    private async handleToolCall(toolCall: ToolCall): Promise<void> {
        const toolName = this.getToolName(toolCall.kind);

        switch (toolCall.status) {
            case ToolCallStatus.Pending:
                this.stream.progress(`🔧 ${toolName} (pending)`);
                break;

            case ToolCallStatus.Completed:
                this.stream.progress(`✓ ${toolName} (completed)`);
                break;

            case ToolCallStatus.Error:
                this.stream.progress(`✗ ${toolName} (error: ${toolCall.error})`);
                break;

            case ToolCallStatus.AwaitingPermission:
                this.stream.progress(`⏸️ ${toolName} (awaiting permission)`);
                break;
        }
    }

    /**
     * Handle permission request from agent
     */
    private async handlePermissionRequest(request: PermissionRequest): Promise<PermissionResponse> {
        // If we have a permission callback, use it
        if (this.onPermissionRequest) {
            const approved = await this.onPermissionRequest(request);
            return {
                id: request.id,
                decision: approved ? 'allow_once' : 'reject_once',
            };
        }

        // Default to reject
        return {
            id: request.id,
            decision: 'reject_once',
        };
    }

    /**
     * Handle agent plan updates
     */
    private handleAgentPlan(plan: AgentPlan): void {
        let planMarkdown = '🎯 Agent Plan:\n\n';

        for (const step of plan.steps) {
            const icon = this.getStepIcon(step.status);
            planMarkdown += `${icon} ${step.description}\n`;
        }

        this.stream.markdown(planMarkdown);
    }

    /**
     * Get icon for plan step status
     */
    private getStepIcon(status: string): string {
        switch (status) {
            case 'completed':
                return '✓';
            case 'in_progress':
                return '⏳';
            case 'pending':
                return '⏸️';
            case 'failed':
                return '✗';
            default:
                return '○';
        }
    }

    /**
     * Get human-readable tool name
     */
    private getToolName(kind: ToolCallKind): string {
        switch (kind) {
            case ToolCallKind.ReadTextFile:
                return 'read_text_file';
            case ToolCallKind.WriteTextFile:
                return 'write_text_file';
            case ToolCallKind.TerminalCreate:
                return 'terminal_create';
            case ToolCallKind.TerminalSendText:
                return 'terminal_send_text';
            case ToolCallKind.TerminalKill:
                return 'terminal_kill';
            case ToolCallKind.MCPToolCall:
                return 'mcp_tool_call';
            default:
                return 'unknown_tool';
        }
    }

    /**
     * Clean up event listeners
     */
    dispose(): void {
        this.acpClient.off('agent_message', this.handleAgentMessageBound);
        this.acpClient.off('tool_call', this.handleToolCallBound);
        this.acpClient.off('permission_request', this.handlePermissionRequestBound);
        this.acpClient.off('agent_plan', this.handleAgentPlanBound);
    }
}

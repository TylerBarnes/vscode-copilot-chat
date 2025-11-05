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
    private currentStream?: vscode.ChatResponseStream;
    private currentToken?: vscode.CancellationToken;

    constructor(
        private acpClient: ACPClient
    ) {}

    /**
     * Handle a chat request by sending it to the ACP agent
     */
    async handleRequest(
        prompt: string,
        references: vscode.ChatPromptReference[],
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        // Store current stream and token for event handlers
        this.currentStream = stream;
        this.currentToken = token;

        // Register event listeners for this request
        const handleAgentMessage = this.handleAgentMessage.bind(this);
        const handleToolCall = this.handleToolCall.bind(this);
        const handlePermissionRequest = this.handlePermissionRequest.bind(this);
        const handleAgentPlan = this.handleAgentPlan.bind(this);

        this.acpClient.on('agent_message', handleAgentMessage);
        this.acpClient.on('tool_call', handleToolCall);
        this.acpClient.on('permission_request', handlePermissionRequest);
        this.acpClient.on('agent_plan', handleAgentPlan);
        try {
            // Check for cancellation
            if (token.isCancellationRequested) {
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
                if (ref.value && typeof ref.value === 'object' && ref.value !== null && 'uri' in ref.value) {
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
        } finally {
            // Clean up event listeners
            this.acpClient.off('agent_message', handleAgentMessage);
            this.acpClient.off('tool_call', handleToolCall);
            this.acpClient.off('permission_request', handlePermissionRequest);
            this.acpClient.off('agent_plan', handleAgentPlan);
            
            // Clear current stream and token
            this.currentStream = undefined;
            this.currentToken = undefined;
        }
    }

    /**
     * Handle agent message content
     */
    private handleAgentMessage(content: AgentMessageContent): void {
        if (!this.currentStream) return;

        switch (content.type) {
            case 'text':
                this.currentStream.markdown(content.text);
                break;

            case 'thinking':
                this.currentStream.progress(`💭 ${content.thinking}`);
                break;

            case 'image':
                const imageMarkdown = `![Image](data:${content.mimeType};base64,${content.data})`;
                this.currentStream.markdown(imageMarkdown);
                break;

            case 'embedded_resource':
                // Create a reference to the embedded resource
                if (content.resource.type === 'file') {
                    const uri = vscode.Uri.parse(content.resource.uri);
                    this.currentStream.reference(uri);
                }
                break;
        }
    }

    /**
     * Handle tool call updates
     */
    private async handleToolCall(toolCall: ToolCall): Promise<void> {
        if (!this.currentStream) return;

        const toolName = this.getToolName(toolCall.kind);

        switch (toolCall.status) {
            case ToolCallStatus.Pending:
                this.currentStream.progress(`🔧 ${toolName} (pending)`);
                break;

            case ToolCallStatus.Completed:
                this.currentStream.progress(`✓ ${toolName} (completed)`);
                break;

            case ToolCallStatus.Error:
                this.currentStream.progress(`✗ ${toolName} (error: ${toolCall.error})`);
                break;

            case ToolCallStatus.AwaitingPermission:
                this.currentStream.progress(`⏸️ ${toolName} (awaiting permission)`);
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
        if (!this.currentStream) return;

        let planMarkdown = '🎯 Agent Plan:\n\n';

        for (const step of plan.steps) {
            const icon = this.getStepIcon(step.status);
            planMarkdown += `${icon} ${step.description}\n`;
        }

        this.currentStream.markdown(planMarkdown);
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

}

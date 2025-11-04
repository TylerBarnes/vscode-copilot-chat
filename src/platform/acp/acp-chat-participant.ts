import * as vscode from 'vscode';
import { ACPClient } from './acp-client';
import { ACPRequestHandler } from './acp-request-handler';
import { SessionManager } from './session-manager';
import { AgentConfigManager } from './agent-config';
import { ContentBlock } from './types';

/**
 * ACP Chat Participant for VS Code
 * 
 * Integrates the ACP client with VS Code's chat interface, handling:
 * - Chat participant registration
 * - Request routing to ACP agent
 * - Session lifecycle management
 * - Reference mapping (VS Code -> ACP embedded resources)
 */
export class ACPChatParticipant {
    private participant: vscode.ChatParticipant;
    private conversationIdCounter = 0;

    constructor(
        private acpClient: ACPClient,
        private requestHandler: ACPRequestHandler,
        private sessionManager: SessionManager,
        private agentConfig: AgentConfigManager
    ) {
        // Register the chat participant
        this.participant = vscode.chat.createChatParticipant(
            'copilot-chat.acp',
            this.handleChatRequest.bind(this)
        );

        // Set participant metadata
        this.participant.iconPath = vscode.Uri.file('resources/acp-icon.png');

        // Initialize the ACP client
        this.acpClient.initialize().catch(err => {
            console.error('Failed to initialize ACP client:', err);
        });

        // Initialize the session manager
        this.sessionManager.initialize().catch(err => {
            console.error('Failed to initialize session manager:', err);
        });
    }

    /**
     * Handle incoming chat requests
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        try {
            // Generate or retrieve conversation ID
            const conversationId = this.getOrCreateConversationId(context);

            // Get or create session
            let sessionId = this.sessionManager.getSessionId(conversationId);
            if (!sessionId) {
                sessionId = await this.sessionManager.createSession(conversationId);
            }

            // Handle cancellation
            if (token.isCancellationRequested) {
                await this.sessionManager.cancelSession(conversationId);
                return { metadata: { command: undefined } };
            }

            // Handle the request via the request handler
            return await this.requestHandler.handleRequest(
                request.prompt,
                Array.from(request.references),
                stream,
                token
            );
        } catch (error) {
            // Display error to user
            const errorMessage = error instanceof Error ? error.message : String(error);
            stream.markdown(`❌ **Error:** ${errorMessage}

`);
            console.error('ACP Chat Participant error:', error);
            return { 
                metadata: { command: undefined },
                errorDetails: { message: errorMessage }
            };
        }
    }

    /**
     * Get or create a conversation ID from the chat context
     */
    private getOrCreateConversationId(context: vscode.ChatContext): string {
        // Try to extract from context history
        // In VS Code, each chat session has a unique context
        // We'll use a hash of the context object as the ID
        // For testing, we'll use a simple counter-based ID
        const contextId = (context as any).conversationId || `conv-${Date.now()}-${this.conversationIdCounter++}`;
        return contextId;
    }

    /**
     * Map VS Code chat references to ACP embedded resources
     */
    private mapReferencesToEmbeddedResources(
        references: readonly vscode.ChatPromptReference[]
    ): ContentBlock[] {
        return references.map(ref => {
            // Handle file references
            if (ref.value && typeof ref.value === 'object' && 'uri' in ref.value) {
                const uri = (ref.value as any).uri;
                return {
                    type: 'embedded_resource' as const,
                    resource: {
                        type: 'file' as const,
                        uri: uri.toString(),
                    },
                };
            }

            // Handle text references
            if (typeof ref.value === 'string') {
                return {
                    type: 'embedded_resource' as const,
                    resource: {
                        type: 'text' as const,
                        text: ref.value,
                    },
                };
            }

            // Fallback: treat as text
            return {
                type: 'embedded_resource' as const,
                resource: {
                    type: 'text' as const,
                    text: String(ref.value),
                },
            };
        });
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.participant.dispose();
        this.acpClient.dispose();
    }
}

import * as vscode from 'vscode';
import { ACPClient } from './acp-client';
import { SessionManager } from './session-manager';
import { ToolCallHandler } from './tool-call-handler';

interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	thinking?: string[];
	plan?: any;
	toolCalls?: any[];
}

/**
 * Provides a custom webview-based chat interface for ACP agents.
 * This replaces VS Code's built-in chat view to avoid hardcoded Copilot dependencies.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private messages: ChatMessage[] = [];
    private currentSessionId?: string;
    private acpClient?: ACPClient;
    private sessionManager?: SessionManager;
    private toolCallHandler?: ToolCallHandler;
    private currentAssistantMessage: ChatMessage | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    /**
     * Initialize the chat view with ACP components after they're created.
     * This allows the view to be registered before the agent is started.
     */
    public initialize(
        acpClient: ACPClient,
        sessionManager: SessionManager,
        toolCallHandler: ToolCallHandler
    ): void {
        try {
            console.log('[ChatViewProvider] initialize() called');
            this.acpClient = acpClient;
            this.sessionManager = sessionManager;
            this.toolCallHandler = toolCallHandler;

            // Listen for session changes
            if (this.sessionManager) {
                console.log('[ChatViewProvider] Registering session change listener');
                this.sessionManager.onDidChangeSession((sessionId) => {
                    this.currentSessionId = sessionId;
                    this.loadSessionMessages(sessionId);
                });
            }

            // Listen for new messages from the agent
            if (this.acpClient) {
                console.log('[ChatViewProvider] Registering message listener via onDidReceiveMessage');
                this.acpClient.onDidReceiveMessage((message) => {
                    console.log('[ChatViewProvider] onDidReceiveMessage handler called with message:', message);
                    this.handleAgentMessage(message);
                });
                console.log('[ChatViewProvider] Message listener registered');
            }
            
            // If view is already resolved, update it
            if (this.view) {
                console.log('[ChatViewProvider] Sending initialized message to webview');
                this.view.webview.postMessage({
                    type: 'initialized',
                    message: 'ACP agent connected and ready'
                });
                console.log('[ChatViewProvider] Initialized message sent');
            }
        } catch (error) {
            console.error('[ChatViewProvider] Error during initialization:', error);
            throw error;
        }
    }

    /**
     * Show a message in the chat view (for warnings, errors, etc.)
     */
    public showMessage(
        message: string,
        type: 'info' | 'warning' | 'error' = 'info',
        action?: { text: string; command: string; args?: any[] }
    ): void {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'showMessage',
                message,
                messageType: type,
                action
            });
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        console.log('[ChatViewProvider] resolveWebviewView called');
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        console.log('[ChatViewProvider] Setting webview HTML');
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        console.log('[ChatViewProvider] Webview HTML set');

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('[ChatViewProvider] Received message from webview:', message);
            console.log('[ChatViewProvider] Message type:', message.type);
            console.log('[ChatViewProvider] Message text:', message.text);
            
            switch (message.type) {
                case 'sendMessage':
                    console.log('[ChatViewProvider] Handling sendMessage case');
                    console.log('[ChatViewProvider] About to call handleUserMessage with text:', message.text);
                    try {
                        await this.handleUserMessage(message.text);
                        console.log('[ChatViewProvider] handleUserMessage completed successfully');
                    } catch (error) {
                        console.error('[ChatViewProvider] handleUserMessage failed:', error);
                    }
                    break;
                case 'newChat':
                    await this.startNewChat();
                    break;
                case 'approveTool':
                    if (this.toolCallHandler) {
                        await this.toolCallHandler.approveTool(message.toolCallId);
                    }
                    break;
                case 'rejectTool':
                    if (this.toolCallHandler) {
                        await this.toolCallHandler.rejectTool(message.toolCallId);
                    }
                    break;
                case 'ready':
                    console.log('[ChatViewProvider] Webview ready, updating...');
                    // Webview is ready, send initial state
                    this.updateWebview();
                    break;
            }
        });

        // Note: onDidReceiveMessage and onDidChangeSession listeners are registered in initialize() method
        // to avoid duplicate registrations
    }

    private async handleUserMessage(text: string): Promise<void> {
        console.log('[ChatViewProvider] handleUserMessage called with text:', text);
        
        if (!text.trim()) {
            console.log('[ChatViewProvider] Empty text, returning');
            return;
        }

        // Check if ACP client is initialized
        if (!this.acpClient || !this.sessionManager) {
            console.log('[ChatViewProvider] ACP client or session manager not initialized');
            this.showMessage('ACP agent is not initialized. Please configure an agent profile.', 'error');
            return;
        }

        console.log('[ChatViewProvider] ACP client and session manager are initialized');

        // Reset current assistant message for new conversation turn
        this.currentAssistantMessage = undefined;
        console.log('[ChatViewProvider] Reset currentAssistantMessage for new turn');

        // Add user message to UI
        const userMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        this.messages.push(userMessage);
        this.updateWebview();

        try {
            // Send to ACP agent
            console.log('[ChatViewProvider] Current session ID:', this.currentSessionId);
            if (!this.currentSessionId) {
                console.log('[ChatViewProvider] No current session, creating new session...');
                const sessionInfo = await this.sessionManager.createSession('default-conversation');
                console.log('[ChatViewProvider] Session created:', sessionInfo);
                this.currentSessionId = sessionInfo.sessionId;
            }

            await this.acpClient.prompt({
                sessionId: this.currentSessionId,
                prompt: [{
                    type: 'text',
                    text
                }]
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send message: ${error}`);
        }
    }

private handleAgentMessage(message: any): void {
        console.log('[ChatViewProvider] handleAgentMessage - update.sessionUpdate:', message.update?.sessionUpdate);
        console.log('[ChatViewProvider] handleAgentMessage - update.content:', JSON.stringify(message.update?.content));
        
        if (message.update?.sessionUpdate === 'agent_message_chunk') {
            // Extract content from the update
            let content = '';
            if (message.update.content) {
                if (message.update.content.type === 'text') {
                    content = message.update.content.text;
                } else if (Array.isArray(message.update.content)) {
                    content = message.update.content
                        .filter((block: any) => block.type === 'text')
                        .map((block: any) => block.text)
                        .join('');
                }
            }
            
            console.log('[ChatViewProvider] handleAgentMessage - extracted content:', content);
            
            // Accumulate streaming chunks into the current assistant message
            if (!this.currentAssistantMessage) {
                this.currentAssistantMessage = {
                    id: this.generateId(),
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now()
                };
                this.messages.push(this.currentAssistantMessage);
            }
            
            // Check if this is a delta (new content) or full content
            // If the new content starts with the existing content, it's full content
            if (content.startsWith(this.currentAssistantMessage.content)) {
                // Full content - replace
                this.currentAssistantMessage.content = content;
            } else {
                // Delta - append
                this.currentAssistantMessage.content += content;
            }
            
            console.log('[ChatViewProvider] handleAgentMessage - accumulated content:', this.currentAssistantMessage.content);
            
            this.updateWebview();
        } else if (message.update?.sessionUpdate === 'agent_message_complete') {
            // Finalize the current assistant message
            if (this.currentAssistantMessage) {
                // Extract any final metadata
                this.currentAssistantMessage.thinking = this.extractThinking(message);
                this.currentAssistantMessage.plan = this.extractPlan(message);
                this.currentAssistantMessage.toolCalls = this.extractToolCalls(message);
            }
            this.currentAssistantMessage = undefined;
            console.log('[ChatViewProvider] handleAgentMessage - message complete');
            this.updateWebview();
        }
    }

	

	private extractThinking(message: any): string[] | undefined {
		if (message.content && Array.isArray(message.content)) {
			const thinkingBlocks = message.content.filter(
				(block: any) => block.type === 'thinking'
			);
			if (thinkingBlocks.length > 0) {
				return thinkingBlocks.map((block: any) => block.text);
			}
		}
		return undefined;
	}

	private extractPlan(message: any): any {
		if (message.content && Array.isArray(message.content)) {
			const planBlock = message.content.find(
				(block: any) => block.type === 'agent_plan'
			);
			return planBlock?.plan;
		}
		return undefined;
	}

	private extractToolCalls(message: any): any[] | undefined {
		if (message.content && Array.isArray(message.content)) {
			const toolBlocks = message.content.filter(
				(block: any) => block.type === 'tool_use'
			);
			if (toolBlocks.length > 0) {
				return toolBlocks;
			}
		}
		return undefined;
	}

    private async startNewChat(): Promise<void> {
        if (!this.sessionManager) {
            this.showMessage('ACP agent is not initialized. Please configure an agent profile.', 'error');
            return;
        }
        
        this.messages = [];
        const sessionInfo = await this.sessionManager.createSession('default-conversation');
        this.currentSessionId = sessionInfo.sessionId;
        this.updateWebview();
    }

    private async loadSessionMessages(sessionId: string): Promise<void> {
        if (!this.sessionManager) {
            return;
        }
        
        // Load messages from session history
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
            // Session doesn't contain messages in current implementation
            // Messages would need to be loaded from agent via session/load
            // Don't clear existing messages - they might be the current conversation
            console.log('[ChatViewProvider] loadSessionMessages called, preserving existing messages');
            // this.messages = []; // Don't clear messages for fresh sessions
            // this.updateWebview(); // Don't update unless we actually loaded history
        }
    }

	private updateWebview(): void {
		if (this.view) {
			this.view.webview.postMessage({
				type: 'updateMessages',
				messages: this.messages
			});
		}
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

    private getHtmlContent(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js')
        );
        
        // Get codicons font URI
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>ACP Chat</title>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h2>ACP Chat</h2>
            <button id="newChatBtn" class="icon-button" title="New Chat">
                <span class="codicon codicon-add"></span>
            </button>
        </div>
        <div id="messages" class="messages-container"></div>
        <div class="input-container">
            <textarea id="messageInput" placeholder="Ask a question..." rows="3"></textarea>
            <button id="sendBtn" class="send-button">
                <span class="codicon codicon-send"></span>
            </button>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

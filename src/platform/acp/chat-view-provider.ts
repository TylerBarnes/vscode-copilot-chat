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
        this.acpClient = acpClient;
        this.sessionManager = sessionManager;
        this.toolCallHandler = toolCallHandler;
        
        // If view is already resolved, update it
        if (this.view) {
            this.view.webview.postMessage({
                type: 'initialized',
                message: 'ACP agent connected and ready'
            });
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
            console.log('[ChatViewProvider] Received message from webview:', message.type);
            switch (message.type) {
                case 'sendMessage':
                    await this.handleUserMessage(message.text);
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

        // Listen for session changes (only if initialized)
        if (this.sessionManager) {
            this.sessionManager.onDidChangeSession((sessionId) => {
                this.currentSessionId = sessionId;
                this.loadSessionMessages(sessionId);
            });
        }

        // Listen for new messages (only if initialized)
        if (this.acpClient) {
            this.acpClient.onDidReceiveMessage((message) => {
                this.handleAgentMessage(message);
            });
        }
	}

    private async handleUserMessage(text: string): Promise<void> {
        if (!text.trim()) {
            return;
        }

        // Check if ACP client is initialized
        if (!this.acpClient || !this.sessionManager) {
            this.showMessage('ACP agent is not initialized. Please configure an agent profile.', 'error');
            return;
        }

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
            if (!this.currentSessionId) {
                const sessionInfo = await this.sessionManager.createSession('default-conversation');
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
		// Map ACP response to chat message
		const chatMessage: ChatMessage = {
			id: this.generateId(),
			role: 'assistant',
			content: this.extractContent(message),
			timestamp: Date.now(),
			thinking: this.extractThinking(message),
			plan: this.extractPlan(message),
			toolCalls: this.extractToolCalls(message)
		};

		this.messages.push(chatMessage);
		this.updateWebview();
	}

	private extractContent(message: any): string {
		if (message.content) {
			if (typeof message.content === 'string') {
				return message.content;
			}
			if (Array.isArray(message.content)) {
				return message.content
					.filter((block: any) => block.type === 'text')
					.map((block: any) => block.text)
					.join('\
');
			}
		}
		return '';
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
            this.messages = [];
            this.updateWebview();
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

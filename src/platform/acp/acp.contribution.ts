/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IInstantiationService } from '../../util/vs/platform/instantiation/common/instantiation';
import { ILogService } from '../log/common/logService';
import { ACPChatParticipant } from './acp-chat-participant';
import { ACPClient } from './acp-client';
import { ACPRequestHandler } from './acp-request-handler';
import { AgentConfigManager } from './agent-config';
import { FileSystemHandler } from './file-system-handler';
import { MCPManager } from './mcp-manager';
import { SessionManager } from './session-manager';
import { TerminalManager } from './terminal-manager';
import { ToolCallHandler } from './tool-call-handler';
import { ChatViewProvider } from './chat-view-provider';
import { IVSCodeExtensionContext } from '../extContext/common/extensionContext';

/**
 * ACP (Agent Client Protocol) Contribution
 * 
 * Initializes and manages the ACP client infrastructure:
 * - Loads agent profiles from configuration
 * - Starts configured MCP servers
 * - Registers custom chat view provider
 * - Registers ACP chat participant
 * - Manages component lifecycle
 */
export class ACPContribution implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private acpClient: ACPClient | undefined;
    private mcpManager: MCPManager | undefined;
    private chatParticipant: ACPChatParticipant | undefined;
    private chatViewProvider: ChatViewProvider | undefined;

    constructor(
        @IInstantiationService private readonly instantiationService: IInstantiationService,
        @ILogService private readonly logService: ILogService,
        @IVSCodeExtensionContext private readonly extensionContext: IVSCodeExtensionContext
    ) {
        this.initialize();
    }

private async initialize(): Promise<void> {
        try {
            this.logService.info('[ACP] Initializing ACP contribution');

            // Register chat view provider FIRST so the UI loads even if initialization fails
            this.chatViewProvider = new ChatViewProvider(
                this.extensionContext.extensionUri
            );
            
            const chatViewDisposable = vscode.window.registerWebviewViewProvider(
                'acp.copilot.chatView',
                this.chatViewProvider
            );
            this.disposables.push(chatViewDisposable);
            this.logService.info('[ACP] Chat view registered');

            // Create core components with proper config path
            const storageUri = this.extensionContext.globalStorageUri;
            
            if (!storageUri) {
                throw new Error('Extension global storage URI is not available');
            }
            
            // Ensure storage directory exists using VS Code's file system API
            try {
                await vscode.workspace.fs.stat(storageUri);
            } catch {
                // Directory doesn't exist, create it
                await vscode.workspace.fs.createDirectory(storageUri);
            }
            
            // Create config file URI using VS Code's joinPath
            const configFileUri = vscode.Uri.joinPath(storageUri, 'agent-config.json');
            const agentConfigManager = new AgentConfigManager(configFileUri.fsPath);
            
            // Initialize agent config manager and wait for it to load
            await agentConfigManager.initialize();
            
            // Get workspace root for FileSystemHandler
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this.logService.warn('[ACP] No workspace folder open');
                this.chatViewProvider.showMessage('Please open a folder or workspace to use ACP Chat.', 'warning');
                return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;
            
            const fileSystemHandler = new FileSystemHandler(cwd);
            const terminalManager = this.instantiationService.createInstance(TerminalManager as any) as TerminalManager;
            const sessionManager = this.instantiationService.createInstance(SessionManager as any) as SessionManager;
            const toolCallHandler = this.instantiationService.createInstance(ToolCallHandler as any, fileSystemHandler, terminalManager);

            // Initialize MCP Manager
            this.mcpManager = this.instantiationService.createInstance(MCPManager);
            this.disposables.push(this.mcpManager);

            // Start configured MCP servers
            await this.startMCPServers();

            // Get active agent profile
            const activeProfile = agentConfigManager.getActiveProfile();
            if (!activeProfile) {
                this.logService.warn('[ACP] No active agent profile configured. Please configure an ACP agent profile in settings.');
                
                // Show a helpful message in the chat view
                this.chatViewProvider.showMessage(
                    'No ACP agent profile configured. Please add an ACP agent profile in the extension settings.',
                    'warning',
                    {
                        text: 'Open Settings',
                        command: 'workbench.action.openSettings',
                        args: ['acp']
                    }
                );
                
                return;
            }

            this.logService.info(`[ACP] Using agent profile: ${activeProfile.name}`);

            // Create ACP client
            const { spawn } = await import('child_process');
            const agentProcess = spawn(activeProfile.executable, activeProfile.args || [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ...activeProfile.env }
            });
            
            this.acpClient = this.instantiationService.createInstance(
                ACPClient,
                agentProcess
            ) as any;
            if (this.acpClient) {
                this.disposables.push(this.acpClient);
            }

            // Create request handler
            if (!this.acpClient) {
                throw new Error('Failed to create ACP client');
            }
            
            const requestHandler = this.instantiationService.createInstance(
                ACPRequestHandler,
                this.acpClient
            ) as any;

            // Initialize chat view with the actual components
            this.chatViewProvider.initialize(
                this.acpClient,
                sessionManager,
                toolCallHandler
            );

            // Create and register chat participant (for command palette integration)
            this.chatParticipant = this.instantiationService.createInstance(
                ACPChatParticipant,
                this.acpClient,
                requestHandler,
                sessionManager
            );
            this.disposables.push(this.chatParticipant);

            this.logService.info('[ACP] ACP contribution initialized successfully');
		} catch (error) {
			this.logService.error('[ACP] Failed to initialize ACP contribution', error);
			// Don't re-throw since initialization is async
		}
	}

	private async startMCPServers(): Promise<void> {
		if (!this.mcpManager) {
			return;
		}

        const config = vscode.workspace.getConfiguration('acp');
        const mcpServers = config.get<Record<string, { command: string; args?: string[]; env?: Record<string, string> }>>('mcpServers', {});

        for (const [name, serverConfig] of Object.entries(mcpServers)) {
            try {
                this.logService.info(`[ACP] Starting MCP server: ${name}`);
                await this.mcpManager.startServer({
                    name,
                    command: serverConfig.command,
                    args: serverConfig.args,
                    env: serverConfig.env,
                    transport: 'stdio'
                });
            } catch (error) {
                this.logService.error(`[ACP] Failed to start MCP server ${name}`, error);
            }
        }
	}

	dispose(): void {
		this.logService.info('[ACP] Disposing ACP contribution');
		this.disposables.forEach(d => d.dispose());
		this.disposables.length = 0;
	}
}

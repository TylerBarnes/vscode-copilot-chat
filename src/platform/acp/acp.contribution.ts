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
import { AgentConfigManager, AgentProfile } from './agent-config';
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
            this.logService.info(`[ACP] Storage URI: ${storageUri.fsPath}`);
            const configFileUri = vscode.Uri.joinPath(storageUri, 'agent-config.json');
            this.logService.info(`[ACP] Config file URI: ${configFileUri.fsPath}`);
            const agentConfigManager = new AgentConfigManager(configFileUri.fsPath);
            
            // Initialize agent config manager and wait for it to load
            this.logService.info('[ACP] Initializing agent config manager...');
            try {
                await agentConfigManager.initialize();
                this.logService.info('[ACP] Agent config manager initialized successfully');
            } catch (error) {
                this.logService.error('[ACP] Failed to initialize agent config manager:', error);
                throw error;
            }
            
            // Get workspace root for FileSystemHandler
            this.logService.info('[ACP] Getting workspace folders...');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            this.logService.info(`[ACP] Workspace folders: ${workspaceFolders ? workspaceFolders.length : 'undefined'}`);
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this.logService.warn('[ACP] No workspace folder open');
                this.chatViewProvider.showMessage('Please open a folder or workspace to use ACP Chat.', 'warning');
                return;
            }
            this.logService.info(`[ACP] First workspace folder URI: ${workspaceFolders[0].uri}`);
            this.logService.info(`[ACP] First workspace folder URI type: ${typeof workspaceFolders[0].uri}`);
            this.logService.info(`[ACP] First workspace folder URI fsPath: ${workspaceFolders[0].uri?.fsPath}`);
            const cwd = workspaceFolders[0].uri.fsPath;
            this.logService.info(`[ACP] cwd: ${cwd}`);
            
            const fileSystemHandler = new FileSystemHandler(cwd);
            const terminalManager = this.instantiationService.createInstance(TerminalManager as any) as TerminalManager;
            const toolCallHandler = this.instantiationService.createInstance(ToolCallHandler as any, fileSystemHandler, terminalManager);

            // Initialize MCP Manager
            this.mcpManager = this.instantiationService.createInstance(MCPManager);
            this.disposables.push(this.mcpManager);

            // Start configured MCP servers
            this.logService.info('[ACP] About to call startMCPServers()');
            await this.startMCPServers();
            this.logService.info('[ACP] startMCPServers() completed');

            // Get active agent profile or fall back to simple settings
            this.logService.info('[ACP] About to call getActiveProfile()');
            let activeProfile = agentConfigManager.getActiveProfile();
            this.logService.info(`[ACP] getActiveProfile() returned: ${activeProfile ? 'profile found' : 'no profile'}`);
            
            // If no profile is configured, try to use simple settings
            if (!activeProfile) {
                const config = vscode.workspace.getConfiguration('copilot-chat.acp.agent');
                const executable = config.get<string>('executable');
                const args = config.get<string[]>('args') || [];
                const env = config.get<Record<string, string>>('env') || {};
                
                if (executable && executable.trim() !== '') {
                    this.logService.info('[ACP] Using simple agent configuration from settings');
                    activeProfile = new AgentProfile({
                        id: 'simple-config',
                        name: 'Simple Configuration',
                        executable,
                        args,
                        env,
                        description: 'Agent configured via simple settings'
                    });
                }
            }
            
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
            this.logService.info(`[ACP] Profile details - executable: ${activeProfile.executable}, args: ${JSON.stringify(activeProfile.args)}, env: ${JSON.stringify(activeProfile.env)}`);

            // Create ACP client
            this.logService.info('[ACP] About to import child_process');
            const { spawn } = await import('child_process');
            this.logService.info('[ACP] child_process imported successfully');
            
            // Validate agent profile before spawning
            if (!activeProfile.executable) {
                const errorMsg = `Agent profile '${activeProfile.name}' has no executable configured`;
                this.logService.error(`[ACP] ${errorMsg}`);
                this.chatViewProvider.showMessage(errorMsg, 'error');
                return;
            }
            
            this.logService.info(`[ACP] Spawning agent: ${activeProfile.executable} ${activeProfile.args?.join(' ') || ''}`);
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

            // Initialize ACP client
            this.logService.info('[ACP] Initializing ACP client...');
            try {
                await this.acpClient!.initialize({
                    protocolVersion: '2024-11-05',
                    clientCapabilities: {
                        fs: {
                            readTextFile: true,
                            writeTextFile: true
                        },
                        terminal: {
                            create: true,
                            output: true,
                            waitForExit: true,
                            kill: true,
                            release: true
                        }
                    },
                    clientInfo: {
                        name: 'vscode-copilot-chat-acp',
                        version: '0.33.0'
                    }
                });
                this.logService.info('[ACP] ACP client initialized successfully');
            } catch (error) {
                this.logService.error('[ACP] Failed to initialize ACP client:', error);
                this.chatViewProvider.showMessage(`Failed to initialize ACP client: ${error}`, 'error');
                return;
            }

            // Create request handler
            if (!this.acpClient) {
                throw new Error('Failed to create ACP client');
            }

            // Initialize session manager (must be after ACPClient is created)
            this.logService.info('[ACP] Creating SessionManager...');
            const sessionManager = new SessionManager(this.acpClient, storageUri);
            this.logService.info('[ACP] SessionManager created');
            
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

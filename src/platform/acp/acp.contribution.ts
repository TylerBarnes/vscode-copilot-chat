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

            // Create core components
            const agentConfigManager = this.instantiationService.createInstance(AgentConfigManager as any);
            const fileSystemHandler = this.instantiationService.createInstance(FileSystemHandler as any) as FileSystemHandler;
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
				this.logService.warn('[ACP] No active agent profile configured');
				return;
			}

			this.logService.info(`[ACP] Using agent profile: ${activeProfile.name}`);

            // Create ACP client
            const { spawn } = await import('child_process');
            const agentProcess = spawn(activeProfile.command, activeProfile.args || [], {
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

            // Register custom chat view provider
            this.chatViewProvider = new ChatViewProvider(
                this.extensionContext.extensionUri,
                this.acpClient,
                sessionManager,
                toolCallHandler
            );
            
            const chatViewDisposable = vscode.window.registerWebviewViewProvider(
                'acp.copilot.chatView',
                this.chatViewProvider
            );
            this.disposables.push(chatViewDisposable);

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

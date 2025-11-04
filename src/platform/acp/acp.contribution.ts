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
import { AgentPlanViewer } from './agent-plan-viewer';
import { ContentBlockMapper } from './content-block-mapper';
import { FileSystemHandler } from './file-system-handler';
import { MCPManager } from './mcp-manager';
import { PermissionHandler } from './permission-handler';
import { SessionManager } from './session-manager';
import { SessionModeSwitcher } from './session-mode-switcher';
import { SlashCommandProvider } from './slash-command-provider';
import { TerminalManager } from './terminal-manager';
import { ThinkingStepsDisplay } from './thinking-steps-display';
import { ToolCallHandler } from './tool-call-handler';

/**
 * ACP (Agent Client Protocol) Contribution
 * 
 * Initializes and manages the ACP client infrastructure:
 * - Loads agent profiles from configuration
 * - Starts configured MCP servers
 * - Registers ACP chat participant
 * - Manages component lifecycle
 */
export class ACPContribution implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private acpClient: ACPClient | undefined;
	private mcpManager: MCPManager | undefined;
	private chatParticipant: ACPChatParticipant | undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		this.initialize();
	}

	private async initialize(): Promise<void> {
		try {
			this.logService.info('[ACP] Initializing ACP contribution');

			// Create core components
			const agentConfigManager = this.instantiationService.createInstance(AgentConfigManager);
			const fileSystemHandler = this.instantiationService.createInstance(FileSystemHandler);
			const terminalManager = this.instantiationService.createInstance(TerminalManager);
			const permissionHandler = this.instantiationService.createInstance(PermissionHandler);
			const sessionManager = this.instantiationService.createInstance(SessionManager);
			const contentBlockMapper = this.instantiationService.createInstance(ContentBlockMapper);
			const toolCallHandler = this.instantiationService.createInstance(ToolCallHandler, fileSystemHandler, terminalManager);
			const agentPlanViewer = this.instantiationService.createInstance(AgentPlanViewer);
			const thinkingStepsDisplay = this.instantiationService.createInstance(ThinkingStepsDisplay);
			const sessionModeSwitcher = this.instantiationService.createInstance(SessionModeSwitcher);
			const slashCommandProvider = this.instantiationService.createInstance(SlashCommandProvider);

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
			this.acpClient = this.instantiationService.createInstance(
				ACPClient,
				activeProfile.command,
				activeProfile.args || []
			);
			this.disposables.push(this.acpClient);

			// Create request handler
			const requestHandler = this.instantiationService.createInstance(
				ACPRequestHandler,
				this.acpClient,
				contentBlockMapper,
				toolCallHandler,
				permissionHandler,
				agentPlanViewer,
				thinkingStepsDisplay,
				sessionModeSwitcher,
				slashCommandProvider
			);

			// Create and register chat participant
			this.chatParticipant = this.instantiationService.createInstance(
				ACPChatParticipant,
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
				await this.mcpManager.startServer(name, serverConfig.command, serverConfig.args, serverConfig.env);
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

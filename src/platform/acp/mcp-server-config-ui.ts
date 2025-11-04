import * as vscode from 'vscode';
import { ConfigurationManager, McpServerConfig } from './configuration-manager';
import { MCPManager } from './mcp-manager';

/**
 * UI for managing MCP server configurations
 */
export class McpServerConfigUI {
	private statusBarItem: vscode.StatusBarItem;

	constructor(
		private configManager: ConfigurationManager,
		private mcpManager: MCPManager
	) {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.command = 'acp.manageMcpServers';
		this.updateStatusBar();
		this.statusBarItem.show();

		// Listen for configuration changes
		this.configManager.onDidChangeConfiguration(() => {
			this.updateStatusBar();
		});
	}

	/**
	 * Show the MCP server management UI
	 */
	async showManagementUI(): Promise<void> {
		const servers = this.configManager.getMcpServers();
		const items: vscode.QuickPickItem[] = [
			{
				label: '$(add) Add New Server',
				description: 'Configure a new MCP server',
			},
			{ label: '', kind: vscode.QuickPickItemKind.Separator },
		];

		// Add existing servers
		for (const server of servers) {
			const status = server.enabled ? '$(check)' : '$(circle-slash)';
			items.push({
				label: `${status} ${server.name}`,
				description: server.command,
				detail: server.enabled ? 'Enabled' : 'Disabled',
			});
		}

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select an MCP server to manage',
		});

		if (!selected) {
			return;
		}

		if (selected.label.includes('Add New Server')) {
			await this.addServer();
		} else {
			const serverName = selected.label.replace(/^\$\([^)]+\)\s+/, '');
			await this.manageServer(serverName);
		}
	}

	/**
	 * Add a new MCP server
	 */
	private async addServer(): Promise<void> {
		const name = await vscode.window.showInputBox({
			prompt: 'Enter server name',
			placeHolder: 'my-mcp-server',
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Server name is required';
				}
				const servers = this.configManager.getMcpServers();
				if (servers.some((s) => s.name === value.trim())) {
					return 'Server name already exists';
				}
				return undefined;
			},
		});

		if (!name) {
			return;
		}

		const command = await vscode.window.showInputBox({
			prompt: 'Enter server command',
			placeHolder: 'npx -y @modelcontextprotocol/server-filesystem',
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Command is required';
				}
				return undefined;
			},
		});

		if (!command) {
			return;
		}

		const argsInput = await vscode.window.showInputBox({
			prompt: 'Enter server arguments (space-separated, optional)',
			placeHolder: '/path/to/directory',
		});

		const args = argsInput ? argsInput.split(' ').filter((a) => a.trim()) : [];

		const envInput = await vscode.window.showInputBox({
			prompt: 'Enter environment variables (KEY=VALUE, comma-separated, optional)',
			placeHolder: 'API_KEY=abc123, DEBUG=true',
		});

		const env: Record<string, string> = {};
		if (envInput) {
			for (const pair of envInput.split(',')) {
				const [key, value] = pair.split('=').map((s) => s.trim());
				if (key && value) {
					env[key] = value;
				}
			}
		}

		const config: McpServerConfig = {
			name: name.trim(),
			command: command.trim(),
			args,
			env,
			enabled: true,
		};

		await this.configManager.addMcpServer(config);
		await this.mcpManager.startServer(config.name);

		vscode.window.showInformationMessage(`MCP server "${config.name}" added and started`);
	}

	/**
	 * Manage an existing MCP server
	 */
	private async manageServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			vscode.window.showErrorMessage(`Server "${serverName}" not found`);
			return;
		}

		const items: vscode.QuickPickItem[] = [
			{
				label: server.enabled ? '$(circle-slash) Disable' : '$(check) Enable',
				description: server.enabled ? 'Stop and disable this server' : 'Enable and start this server',
			},
			{
				label: '$(edit) Edit',
				description: 'Edit server configuration',
			},
			{
				label: '$(refresh) Restart',
				description: 'Restart the server',
			},
			{
				label: '$(debug-disconnect) Test Connection',
				description: 'Test if the server is responding',
			},
			{
				label: '$(trash) Delete',
				description: 'Remove this server',
			},
		];

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: `Manage ${serverName}`,
		});

		if (!selected) {
			return;
		}

		if (selected.label.includes('Enable') || selected.label.includes('Disable')) {
			await this.toggleServer(serverName);
		} else if (selected.label.includes('Edit')) {
			await this.editServer(serverName);
		} else if (selected.label.includes('Restart')) {
			await this.restartServer(serverName);
		} else if (selected.label.includes('Test Connection')) {
			await this.testServer(serverName);
		} else if (selected.label.includes('Delete')) {
			await this.deleteServer(serverName);
		}
	}

	/**
	 * Toggle server enabled state
	 */
	private async toggleServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			return;
		}

		const newEnabled = !server.enabled;
		await this.configManager.updateMcpServer(serverName, { enabled: newEnabled });

		if (newEnabled) {
			await this.mcpManager.startServer(serverName);
			vscode.window.showInformationMessage(`MCP server "${serverName}" enabled and started`);
		} else {
			await this.mcpManager.stopServer(serverName);
			vscode.window.showInformationMessage(`MCP server "${serverName}" disabled and stopped`);
		}
	}

	/**
	 * Edit server configuration
	 */
	private async editServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			return;
		}

		const command = await vscode.window.showInputBox({
			prompt: 'Enter server command',
			value: server.command,
			validateInput: (value) => {
				if (!value.trim()) {
					return 'Command is required';
				}
				return undefined;
			},
		});

		if (!command) {
			return;
		}

		const argsInput = await vscode.window.showInputBox({
			prompt: 'Enter server arguments (space-separated, optional)',
			value: server.args.join(' '),
		});

		const args = argsInput ? argsInput.split(' ').filter((a) => a.trim()) : [];

		const envInput = await vscode.window.showInputBox({
			prompt: 'Enter environment variables (KEY=VALUE, comma-separated, optional)',
			value: Object.entries(server.env)
				.map(([k, v]) => `${k}=${v}`)
				.join(', '),
		});

		const env: Record<string, string> = {};
		if (envInput) {
			for (const pair of envInput.split(',')) {
				const [key, value] = pair.split('=').map((s) => s.trim());
				if (key && value) {
					env[key] = value;
				}
			}
		}

		await this.configManager.updateMcpServer(serverName, {
			command: command.trim(),
			args,
			env,
		});

		// Restart if enabled
		if (server.enabled) {
			await this.mcpManager.stopServer(serverName);
			await this.mcpManager.startServer(serverName);
			vscode.window.showInformationMessage(`MCP server "${serverName}" updated and restarted`);
		} else {
			vscode.window.showInformationMessage(`MCP server "${serverName}" updated`);
		}
	}

	/**
	 * Restart server
	 */
	private async restartServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			return;
		}

		if (!server.enabled) {
			vscode.window.showWarningMessage(`Server "${serverName}" is disabled. Enable it first.`);
			return;
		}

		await this.mcpManager.stopServer(serverName);
		await this.mcpManager.startServer(serverName);
		vscode.window.showInformationMessage(`MCP server "${serverName}" restarted`);
	}

	/**
	 * Test server connection
	 */
	private async testServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			return;
		}

		if (!server.enabled) {
			vscode.window.showWarningMessage(`Server "${serverName}" is disabled. Enable it first.`);
			return;
		}

		try {
			const tools = await this.mcpManager.getTools(serverName);
			vscode.window.showInformationMessage(
				`MCP server "${serverName}" is responding. Available tools: ${tools.length}`
			);
		} catch (error) {
			vscode.window.showErrorMessage(
				`MCP server "${serverName}" connection failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Delete server
	 */
	private async deleteServer(serverName: string): Promise<void> {
		const server = this.configManager.getMcpServer(serverName);
		if (!server) {
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Delete MCP server "${serverName}"?`,
			{ modal: true },
			'Delete'
		);

		if (confirm !== 'Delete') {
			return;
		}

		if (server.enabled) {
			await this.mcpManager.stopServer(serverName);
		}

		await this.configManager.removeMcpServer(serverName);
		vscode.window.showInformationMessage(`MCP server "${serverName}" deleted`);
	}

	/**
	 * Update status bar with server count
	 */
	private updateStatusBar(): void {
		const servers = this.configManager.getMcpServers();
		const enabledCount = servers.filter((s) => s.enabled).length;
		this.statusBarItem.text = `$(server) MCP: ${enabledCount}/${servers.length}`;
		this.statusBarItem.tooltip = `${enabledCount} of ${servers.length} MCP servers enabled`;
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.statusBarItem.dispose();
	}
}

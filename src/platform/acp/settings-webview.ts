import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration-manager';
import { AgentProfileSelector } from './agent-profile-selector';
import { McpServerConfigUI } from './mcp-server-config-ui';
import { PermissionPolicyManager } from './permission-policy-manager';

/**
 * Settings webview provider for ACP configuration
 */
export class SettingsWebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'acp.settingsView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly configManager: ConfigurationManager,
		private readonly profileSelector: AgentProfileSelector,
		private readonly mcpServerUI: McpServerConfigUI,
		private readonly permissionManager: PermissionPolicyManager
	) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case 'getConfig':
					await this._sendConfig();
					break;
				case 'updateAgentProfile':
					await this.configManager.updateAgentProfile(data.profile);
					await this._sendConfig();
					break;
				case 'removeAgentProfile':
					await this.configManager.removeAgentProfile(data.name);
					await this._sendConfig();
					break;
				case 'updateMcpServer':
					await this.configManager.updateMcpServer(data.server);
					await this._sendConfig();
					break;
				case 'removeMcpServer':
					await this.configManager.removeMcpServer(data.name);
					await this._sendConfig();
					break;
				case 'updatePermissionPolicy':
					await this.configManager.updatePermissionPolicy(data.policy);
					await this._sendConfig();
					break;
				case 'removePermissionPolicy':
					await this.configManager.removePermissionPolicy(data.pattern);
					await this._sendConfig();
					break;
				case 'updateSessionConfig':
					await this.configManager.updateSessionConfig(data.config);
					await this._sendConfig();
					break;
				case 'openAgentProfileSelector':
					await this.profileSelector.showProfileSelector();
					break;
				case 'openMcpServerUI':
					await this.mcpServerUI.showManagementUI();
					break;
				case 'openPermissionManager':
					await this.permissionManager.showManagementUI();
					break;
			}
		});

		// Listen for configuration changes
		this.configManager.onConfigChange(() => {
			this._sendConfig();
		});

		// Send initial config
		this._sendConfig();
	}

	private async _sendConfig() {
		if (!this._view) {
			return;
		}

		const config = this.configManager.getConfiguration();
		this._view.webview.postMessage({
			type: 'config',
			config
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ACP Settings</title>
	<style>
		body {
			padding: 0;
			margin: 0;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		.container {
			padding: 20px;
			max-width: 800px;
		}
		h1 {
			font-size: 24px;
			font-weight: 600;
			margin: 0 0 20px 0;
			color: var(--vscode-foreground);
		}
		h2 {
			font-size: 18px;
			font-weight: 600;
			margin: 30px 0 15px 0;
			color: var(--vscode-foreground);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 8px;
		}
		.section {
			margin-bottom: 30px;
		}
		.setting-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 0;
			border-bottom: 1px solid var(--vscode-widget-border);
		}
		.setting-row:last-child {
			border-bottom: none;
		}
		.setting-label {
			flex: 1;
			display: flex;
			flex-direction: column;
		}
		.setting-name {
			font-weight: 500;
			margin-bottom: 4px;
		}
		.setting-description {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.setting-value {
			margin-left: 20px;
		}
		button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 6px 14px;
			cursor: pointer;
			font-size: 13px;
			border-radius: 2px;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		button.secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		button.secondary:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 10px;
			font-size: 11px;
			font-weight: 500;
			background-color: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}
		.list-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 8px 12px;
			margin: 4px 0;
			background-color: var(--vscode-list-inactiveSelectionBackground);
			border-radius: 4px;
		}
		.list-item-content {
			flex: 1;
		}
		.list-item-title {
			font-weight: 500;
			margin-bottom: 2px;
		}
		.list-item-subtitle {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.list-item-actions {
			display: flex;
			gap: 8px;
		}
		.empty-state {
			text-align: center;
			padding: 40px 20px;
			color: var(--vscode-descriptionForeground);
		}
		.icon {
			margin-right: 6px;
		}
		input[type="checkbox"] {
			cursor: pointer;
		}
		select {
			background-color: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
			padding: 4px 8px;
			cursor: pointer;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🤖 ACP Settings</h1>

		<!-- Agent Profiles Section -->
		<div class="section">
			<h2>Agent Profiles</h2>
			<div id="agent-profiles"></div>
			<button onclick="openAgentProfileSelector()">
				<span class="icon">➕</span>Manage Profiles
			</button>
		</div>

		<!-- MCP Servers Section -->
		<div class="section">
			<h2>MCP Servers</h2>
			<div id="mcp-servers"></div>
			<button onclick="openMcpServerUI()">
				<span class="icon">🔌</span>Manage Servers
			</button>
		</div>

		<!-- Permission Policies Section -->
		<div class="section">
			<h2>Permission Policies</h2>
			<div id="permission-policies"></div>
			<button onclick="openPermissionManager()">
				<span class="icon">🔒</span>Manage Policies
			</button>
		</div>

		<!-- Session Settings Section -->
		<div class="section">
			<h2>Session Settings</h2>
			<div id="session-settings"></div>
		</div>

		<!-- UI Settings Section -->
		<div class="section">
			<h2>UI Settings</h2>
			<div id="ui-settings"></div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let currentConfig = null;

		// Request initial config
		vscode.postMessage({ type: 'getConfig' });

		// Handle messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			if (message.type === 'config') {
				currentConfig = message.config;
				renderConfig();
			}
		});

		function renderConfig() {
			if (!currentConfig) return;

			renderAgentProfiles();
			renderMcpServers();
			renderPermissionPolicies();
			renderSessionSettings();
			renderUISettings();
		}

		function renderAgentProfiles() {
			const container = document.getElementById('agent-profiles');
			const profiles = currentConfig.agentProfiles || [];

			if (profiles.length === 0) {
				container.innerHTML = '<div class="empty-state">No agent profiles configured</div>';
				return;
			}

			container.innerHTML = profiles.map(profile => \`
				<div class="list-item">
					<div class="list-item-content">
						<div class="list-item-title">\${profile.name}</div>
						<div class="list-item-subtitle">\${profile.executable} \${(profile.args || []).join(' ')}</div>
					</div>
				</div>
			\`).join('');
		}

		function renderMcpServers() {
			const container = document.getElementById('mcp-servers');
			const servers = currentConfig.mcpServers || [];

			if (servers.length === 0) {
				container.innerHTML = '<div class="empty-state">No MCP servers configured</div>';
				return;
			}

			container.innerHTML = servers.map(server => \`
				<div class="list-item">
					<div class="list-item-content">
						<div class="list-item-title">
							\${server.name}
							\${server.enabled ? '<span class="badge">Enabled</span>' : '<span class="badge">Disabled</span>'}
						</div>
						<div class="list-item-subtitle">\${server.command} \${(server.args || []).join(' ')}</div>
					</div>
				</div>
			\`).join('');
		}

		function renderPermissionPolicies() {
			const container = document.getElementById('permission-policies');
			const autoAllow = currentConfig.permissions?.autoAllow || [];
			const autoReject = currentConfig.permissions?.autoReject || [];

			if (autoAllow.length === 0 && autoReject.length === 0) {
				container.innerHTML = '<div class="empty-state">No permission policies configured</div>';
				return;
			}

			const allowPolicies = autoAllow.map(policy => \`
				<div class="list-item">
					<div class="list-item-content">
						<div class="list-item-title">
							<span class="icon">✅</span>\${policy.pattern}
						</div>
						\${policy.description ? \`<div class="list-item-subtitle">\${policy.description}</div>\` : ''}
					</div>
				</div>
			\`).join('');

			const rejectPolicies = autoReject.map(policy => \`
				<div class="list-item">
					<div class="list-item-content">
						<div class="list-item-title">
							<span class="icon">❌</span>\${policy.pattern}
						</div>
						\${policy.description ? \`<div class="list-item-subtitle">\${policy.description}</div>\` : ''}
					</div>
				</div>
			\`).join('');

			container.innerHTML = allowPolicies + rejectPolicies;
		}

		function renderSessionSettings() {
			const container = document.getElementById('session-settings');
			const session = currentConfig.session || {};

			container.innerHTML = \`
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Auto-save Sessions</div>
						<div class="setting-description">Automatically save chat sessions</div>
					</div>
					<div class="setting-value">
						<input type="checkbox" 
							\${session.autoSave !== false ? 'checked' : ''} 
							onchange="updateSessionSetting('autoSave', this.checked)">
					</div>
				</div>
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Default Mode</div>
						<div class="setting-description">Default session mode for new chats</div>
					</div>
					<div class="setting-value">
						<select onchange="updateSessionSetting('defaultMode', this.value)">
							<option value="chat" \${session.defaultMode === 'chat' ? 'selected' : ''}>Chat</option>
							<option value="code" \${session.defaultMode === 'code' ? 'selected' : ''}>Code</option>
							<option value="architect" \${session.defaultMode === 'architect' ? 'selected' : ''}>Architect</option>
						</select>
					</div>
				</div>
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Max History</div>
						<div class="setting-description">Maximum number of sessions to keep in history</div>
					</div>
					<div class="setting-value">
						<select onchange="updateSessionSetting('maxHistory', parseInt(this.value))">
							<option value="10" \${session.maxHistory === 10 ? 'selected' : ''}>10</option>
							<option value="25" \${session.maxHistory === 25 ? 'selected' : ''}>25</option>
							<option value="50" \${session.maxHistory === 50 ? 'selected' : ''}>50</option>
							<option value="100" \${session.maxHistory === 100 ? 'selected' : ''}>100</option>
						</select>
					</div>
				</div>
			\`;
		}

		function renderUISettings() {
			const container = document.getElementById('ui-settings');
			const ui = currentConfig.ui || {};

			container.innerHTML = \`
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Show Thinking Steps</div>
						<div class="setting-description">Display agent reasoning in chat</div>
					</div>
					<div class="setting-value">
						<input type="checkbox" 
							\${ui.showThinkingSteps !== false ? 'checked' : ''} 
							onchange="updateUISetting('showThinkingSteps', this.checked)">
					</div>
				</div>
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Show Agent Plan</div>
						<div class="setting-description">Display agent plan in chat</div>
					</div>
					<div class="setting-value">
						<input type="checkbox" 
							\${ui.showAgentPlan !== false ? 'checked' : ''} 
							onchange="updateUISetting('showAgentPlan', this.checked)">
					</div>
				</div>
				<div class="setting-row">
					<div class="setting-label">
						<div class="setting-name">Collapse Thinking Steps</div>
						<div class="setting-description">Collapse thinking steps by default</div>
					</div>
					<div class="setting-value">
						<input type="checkbox" 
							\${ui.collapseThinkingSteps !== false ? 'checked' : ''} 
							onchange="updateUISetting('collapseThinkingSteps', this.checked)">
					</div>
				</div>
			\`;
		}

		function updateSessionSetting(key, value) {
			const session = currentConfig.session || {};
			session[key] = value;
			vscode.postMessage({
				type: 'updateSessionConfig',
				config: session
			});
		}

		function updateUISetting(key, value) {
			const ui = currentConfig.ui || {};
			ui[key] = value;
			// UI settings are stored directly in workspace config
			vscode.postMessage({
				type: 'updateSessionConfig',
				config: { ui: { ...ui, [key]: value } }
			});
		}

		function openAgentProfileSelector() {
			vscode.postMessage({ type: 'openAgentProfileSelector' });
		}

		function openMcpServerUI() {
			vscode.postMessage({ type: 'openMcpServerUI' });
		}

		function openPermissionManager() {
			vscode.postMessage({ type: 'openPermissionManager' });
		}
	</script>
</body>
</html>`;
	}
}

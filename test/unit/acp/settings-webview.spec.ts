import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsWebviewProvider } from '../../../src/platform/acp/settings-webview';
import type { AgentProfile, McpServerConfig, PermissionPolicy, SessionConfig } from '../../../src/platform/acp/types';

// Mock vscode module
const mockWebview = {
	html: '',
	options: {},
	onDidReceiveMessage: vi.fn(),
	postMessage: vi.fn(),
	asWebviewUri: vi.fn((uri) => uri)
};

const mockWebviewView = {
	webview: mockWebview,
	visible: true,
	show: vi.fn(),
	onDidDispose: vi.fn(),
	onDidChangeVisibility: vi.fn()
};

const mockUri = {
	fsPath: '/test/path',
	scheme: 'file',
	authority: '',
	path: '/test/path',
	query: '',
	fragment: '',
	with: vi.fn(),
	toString: vi.fn(() => 'file:///test/path')
};

vi.mock('vscode', async () => {
	return {
		Uri: {
			parse: vi.fn(() => mockUri),
			file: vi.fn(() => mockUri),
			joinPath: vi.fn(() => mockUri)
		},
		CancellationTokenSource: vi.fn(),
		EventEmitter: vi.fn(() => ({
			event: vi.fn(),
			fire: vi.fn()
		}))
	};
});

describe('SettingsWebviewProvider', () => {
	let provider: SettingsWebviewProvider;
	let mockConfigManager: any;
	let mockProfileSelector: any;
	let mockMcpServerUI: any;
	let mockPermissionManager: any;
	let messageHandler: (data: any) => void;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockWebview.html = '';
		mockWebview.options = {};
		mockWebview.onDidReceiveMessage.mockReset();
		mockWebview.postMessage.mockReset();

		// Create mock dependencies
		mockConfigManager = {
			getConfiguration: vi.fn(() => ({
				agentProfiles: [],
				mcpServers: [],
				permissions: { autoAllow: [], autoReject: [] },
				session: {},
				ui: {}
			})),
			updateAgentProfile: vi.fn(),
			removeAgentProfile: vi.fn(),
			updateMcpServer: vi.fn(),
			removeMcpServer: vi.fn(),
			updatePermissionPolicy: vi.fn(),
			removePermissionPolicy: vi.fn(),
			updateSessionConfig: vi.fn(),
			onConfigChange: vi.fn((callback) => {
				// Store callback for testing
				return { dispose: vi.fn() };
			})
		};

		mockProfileSelector = {
			showProfileSelector: vi.fn()
		};

		mockMcpServerUI = {
			showManagementUI: vi.fn()
		};

		mockPermissionManager = {
			showManagementUI: vi.fn()
		};

		const vscode = await import('vscode');
		const extensionUri = vscode.Uri.parse('file:///test/extension');

		provider = new SettingsWebviewProvider(
			extensionUri,
			mockConfigManager,
			mockProfileSelector,
			mockMcpServerUI,
			mockPermissionManager
		);

		// Capture message handler
		mockWebview.onDidReceiveMessage.mockImplementation((handler) => {
			messageHandler = handler;
			return { dispose: vi.fn() };
		});
	});

	describe('resolveWebviewView', () => {
		it('should initialize webview with correct options', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.options).toEqual({
				enableScripts: true,
				localResourceRoots: [mockUri]
			});
		});

		it('should set HTML content', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.html).toContain('<!DOCTYPE html>');
			expect(mockWebview.html).toContain('ACP Settings');
			expect(mockWebview.html).toContain('Agent Profiles');
			expect(mockWebview.html).toContain('MCP Servers');
			expect(mockWebview.html).toContain('Permission Policies');
		});

		it('should register message handler', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
		});

		it('should register config change listener', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockConfigManager.onConfigChange).toHaveBeenCalledTimes(1);
		});

		it('should send initial config', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});
	});

	describe('message handling', () => {
		beforeEach(() => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
			mockWebview.postMessage.mockClear();
		});

		it('should handle getConfig message', async () => {
			await messageHandler({ type: 'getConfig' });

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle updateAgentProfile message', async () => {
			const profile: AgentProfile = {
				name: 'test-agent',
				executable: 'node',
				args: ['agent.js']
			};

			await messageHandler({ type: 'updateAgentProfile', profile });

			expect(mockConfigManager.updateAgentProfile).toHaveBeenCalledWith(profile);
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle removeAgentProfile message', async () => {
			await messageHandler({ type: 'removeAgentProfile', name: 'test-agent' });

			expect(mockConfigManager.removeAgentProfile).toHaveBeenCalledWith('test-agent');
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle updateMcpServer message', async () => {
			const server: McpServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				enabled: true
			};

			await messageHandler({ type: 'updateMcpServer', server });

			expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(server);
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle removeMcpServer message', async () => {
			await messageHandler({ type: 'removeMcpServer', name: 'test-server' });

			expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith('test-server');
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle updatePermissionPolicy message', async () => {
			const policy: PermissionPolicy = {
				pattern: 'fs:*',
				description: 'Allow all file system operations'
			};

			await messageHandler({ type: 'updatePermissionPolicy', policy });

			expect(mockConfigManager.updatePermissionPolicy).toHaveBeenCalledWith(policy);
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle removePermissionPolicy message', async () => {
			await messageHandler({ type: 'removePermissionPolicy', pattern: 'fs:*' });

			expect(mockConfigManager.removePermissionPolicy).toHaveBeenCalledWith('fs:*');
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle updateSessionConfig message', async () => {
			const config: SessionConfig = {
				autoSave: true,
				defaultMode: 'chat',
				maxHistory: 50
			};

			await messageHandler({ type: 'updateSessionConfig', config });

			expect(mockConfigManager.updateSessionConfig).toHaveBeenCalledWith(config);
			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should handle openAgentProfileSelector message', async () => {
			await messageHandler({ type: 'openAgentProfileSelector' });

			expect(mockProfileSelector.showProfileSelector).toHaveBeenCalledTimes(1);
		});

		it('should handle openMcpServerUI message', async () => {
			await messageHandler({ type: 'openMcpServerUI' });

			expect(mockMcpServerUI.showManagementUI).toHaveBeenCalledTimes(1);
		});

		it('should handle openPermissionManager message', async () => {
			await messageHandler({ type: 'openPermissionManager' });

			expect(mockPermissionManager.showManagementUI).toHaveBeenCalledTimes(1);
		});
	});

	describe('config updates', () => {
		it('should send config when config changes', () => {
			let configChangeCallback: () => void;
			mockConfigManager.onConfigChange.mockImplementation((callback: () => void) => {
				configChangeCallback = callback;
				return { dispose: vi.fn() };
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
			mockWebview.postMessage.mockClear();

			// Trigger config change
			configChangeCallback!();

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.any(Object)
			});
		});

		it('should include agent profiles in config', () => {
			const profiles: AgentProfile[] = [
				{ name: 'agent1', executable: 'node', args: ['agent1.js'] },
				{ name: 'agent2', executable: 'node', args: ['agent2.js'] }
			];

			mockConfigManager.getConfiguration.mockReturnValue({
				agentProfiles: profiles,
				mcpServers: [],
				permissions: { autoAllow: [], autoReject: [] },
				session: {},
				ui: {}
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.objectContaining({
					agentProfiles: profiles
				})
			});
		});

		it('should include MCP servers in config', () => {
			const servers: McpServerConfig[] = [
				{ name: 'server1', command: 'node', args: ['server1.js'], enabled: true },
				{ name: 'server2', command: 'node', args: ['server2.js'], enabled: false }
			];

			mockConfigManager.getConfiguration.mockReturnValue({
				agentProfiles: [],
				mcpServers: servers,
				permissions: { autoAllow: [], autoReject: [] },
				session: {},
				ui: {}
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.objectContaining({
					mcpServers: servers
				})
			});
		});

		it('should include permission policies in config', () => {
			const autoAllow: PermissionPolicy[] = [
				{ pattern: 'fs:read:*', description: 'Allow all reads' }
			];
			const autoReject: PermissionPolicy[] = [
				{ pattern: 'fs:delete:*', description: 'Reject all deletes' }
			];

			mockConfigManager.getConfiguration.mockReturnValue({
				agentProfiles: [],
				mcpServers: [],
				permissions: { autoAllow, autoReject },
				session: {},
				ui: {}
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.objectContaining({
					permissions: { autoAllow, autoReject }
				})
			});
		});

		it('should include session config', () => {
			const session: SessionConfig = {
				autoSave: true,
				defaultMode: 'code',
				maxHistory: 100
			};

			mockConfigManager.getConfiguration.mockReturnValue({
				agentProfiles: [],
				mcpServers: [],
				permissions: { autoAllow: [], autoReject: [] },
				session,
				ui: {}
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.objectContaining({
					session
				})
			});
		});

		it('should include UI config', () => {
			const ui = {
				showThinkingSteps: true,
				showAgentPlan: false,
				collapseThinkingSteps: true
			};

			mockConfigManager.getConfiguration.mockReturnValue({
				agentProfiles: [],
				mcpServers: [],
				permissions: { autoAllow: [], autoReject: [] },
				session: {},
				ui
			});

			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'config',
				config: expect.objectContaining({
					ui
				})
			});
		});
	});

	describe('HTML generation', () => {
		it('should include all required sections', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.html).toContain('Agent Profiles');
			expect(mockWebview.html).toContain('MCP Servers');
			expect(mockWebview.html).toContain('Permission Policies');
			expect(mockWebview.html).toContain('Session Settings');
			expect(mockWebview.html).toContain('UI Settings');
		});

		it('should include management buttons', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.html).toContain('openAgentProfileSelector');
			expect(mockWebview.html).toContain('openMcpServerUI');
			expect(mockWebview.html).toContain('openPermissionManager');
		});

		it('should include JavaScript for rendering', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.html).toContain('renderAgentProfiles');
			expect(mockWebview.html).toContain('renderMcpServers');
			expect(mockWebview.html).toContain('renderPermissionPolicies');
			expect(mockWebview.html).toContain('renderSessionSettings');
			expect(mockWebview.html).toContain('renderUISettings');
		});

		it('should include VS Code API acquisition', () => {
			provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

			expect(mockWebview.html).toContain('acquireVsCodeApi');
		});
	});
});

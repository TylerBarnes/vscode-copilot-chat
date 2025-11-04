import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServerConfigUI } from '../../../src/platform/acp/mcp-server-config-ui';
import type { ConfigurationManager, McpServerConfig } from '../../../src/platform/acp/configuration-manager';
import type { MCPManager } from '../../../src/platform/acp/mcp-manager';

// Mock vscode module
vi.mock('vscode', () => {
	const mockStatusBarItem = {
		text: '',
		tooltip: '',
		command: '',
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
	};

	const mockWindow = {
		createStatusBarItem: vi.fn(() => mockStatusBarItem),
		showQuickPick: vi.fn(),
		showInputBox: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	};

	return {
		window: mockWindow,
		StatusBarAlignment: { Right: 2 },
		QuickPickItemKind: { Separator: -1 },
		__mockStatusBarItem: mockStatusBarItem,
		__mockWindow: mockWindow,
	};
});

describe('McpServerConfigUI', () => {
	let ui: McpServerConfigUI;
	let mockConfigManager: ConfigurationManager;
	let mockMcpManager: MCPManager;
	let configChangeCallback: () => void;
	let mockStatusBarItem: any;
	let mockWindow: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Import mocks from vscode module
		const vscode = await import('vscode');
		mockStatusBarItem = (vscode as any).__mockStatusBarItem;
		mockWindow = (vscode as any).__mockWindow;

		// Reset mock state
		mockStatusBarItem.text = '';
		mockStatusBarItem.tooltip = '';
		mockStatusBarItem.command = '';

		// Create mock managers
		mockConfigManager = {
			getMcpServers: vi.fn(() => []),
			getMcpServer: vi.fn(),
			addMcpServer: vi.fn(),
			updateMcpServer: vi.fn(),
			removeMcpServer: vi.fn(),
			onDidChangeConfiguration: vi.fn((callback) => {
				configChangeCallback = callback;
				return { dispose: vi.fn() };
			}),
		} as any;

		mockMcpManager = {
			startServer: vi.fn(),
			stopServer: vi.fn(),
			getTools: vi.fn(() => Promise.resolve([])),
		} as any;

		ui = new McpServerConfigUI(mockConfigManager, mockMcpManager);
	});

	describe('initialization', () => {
		it('should create status bar item', () => {
			expect(mockWindow.createStatusBarItem).toHaveBeenCalledWith(2, 100);
			expect(mockStatusBarItem.command).toBe('acp.manageMcpServers');
			expect(mockStatusBarItem.show).toHaveBeenCalled();
		});

		it('should update status bar with server count', () => {
			expect(mockStatusBarItem.text).toBe('$(server) MCP: 0/0');
			expect(mockStatusBarItem.tooltip).toBe('0 of 0 MCP servers enabled');
		});

		it('should listen for configuration changes', () => {
			expect(mockConfigManager.onDidChangeConfiguration).toHaveBeenCalled();
		});

		it('should update status bar on configuration change', () => {
			(mockConfigManager.getMcpServers as any).mockReturnValue([
				{ name: 'server1', enabled: true },
				{ name: 'server2', enabled: false },
			]);

			configChangeCallback();

			expect(mockStatusBarItem.text).toBe('$(server) MCP: 1/2');
			expect(mockStatusBarItem.tooltip).toBe('1 of 2 MCP servers enabled');
		});
	});

	describe('showManagementUI', () => {
		it('should show quick pick with add option', async () => {
			mockWindow.showQuickPick.mockResolvedValue(undefined);

			await ui.showManagementUI();

			expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ label: '$(add) Add New Server' }),
				]),
				expect.any(Object)
			);
		});

		it('should show existing servers', async () => {
			(mockConfigManager.getMcpServers as any).mockReturnValue([
				{ name: 'server1', command: 'cmd1', enabled: true },
				{ name: 'server2', command: 'cmd2', enabled: false },
			]);
			mockWindow.showQuickPick.mockResolvedValue(undefined);

			await ui.showManagementUI();

			expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ label: '$(check) server1', description: 'cmd1' }),
					expect.objectContaining({ label: '$(circle-slash) server2', description: 'cmd2' }),
				]),
				expect.any(Object)
			);
		});

		it('should handle add new server selection', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('new-server') // name
				.mockResolvedValueOnce('npx server') // command
				.mockResolvedValueOnce('') // args
				.mockResolvedValueOnce(''); // env

			await ui.showManagementUI();

			expect(mockConfigManager.addMcpServer).toHaveBeenCalledWith({
				name: 'new-server',
				command: 'npx server',
				args: [],
				env: {},
				enabled: true,
			});
			expect(mockMcpManager.startServer).toHaveBeenCalledWith('new-server');
		});

		it('should handle existing server selection', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce(undefined); // cancel manage menu

			await ui.showManagementUI();

			expect(mockConfigManager.getMcpServer).toHaveBeenCalledWith('server1');
		});
	});

	describe('addServer', () => {
		it('should validate server name', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox.mockResolvedValue('');

			await ui.showManagementUI();

			const validator = mockWindow.showInputBox.mock.calls[0][0].validateInput;
			expect(validator('')).toBe('Server name is required');
			expect(validator('  ')).toBe('Server name is required');
		});

		it('should prevent duplicate server names', async () => {
			(mockConfigManager.getMcpServers as any).mockReturnValue([{ name: 'existing' }]);
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox.mockResolvedValue('');

			await ui.showManagementUI();

			const validator = mockWindow.showInputBox.mock.calls[0][0].validateInput;
			expect(validator('existing')).toBe('Server name already exists');
		});

		it('should validate command', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('server1')
				.mockResolvedValueOnce('');

			await ui.showManagementUI();

			const validator = mockWindow.showInputBox.mock.calls[1][0].validateInput;
			expect(validator('')).toBe('Command is required');
			expect(validator('  ')).toBe('Command is required');
		});

		it('should parse arguments correctly', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('server1')
				.mockResolvedValueOnce('npx server')
				.mockResolvedValueOnce('arg1 arg2 arg3')
				.mockResolvedValueOnce('');

			await ui.showManagementUI();

			expect(mockConfigManager.addMcpServer).toHaveBeenCalledWith(
				expect.objectContaining({
					args: ['arg1', 'arg2', 'arg3'],
				})
			);
		});

		it('should parse environment variables correctly', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('server1')
				.mockResolvedValueOnce('npx server')
				.mockResolvedValueOnce('')
				.mockResolvedValueOnce('KEY1=value1, KEY2=value2');

			await ui.showManagementUI();

			expect(mockConfigManager.addMcpServer).toHaveBeenCalledWith(
				expect.objectContaining({
					env: { KEY1: 'value1', KEY2: 'value2' },
				})
			);
		});

		it('should show success message', async () => {
			mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Add New Server' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('server1')
				.mockResolvedValueOnce('npx server')
				.mockResolvedValueOnce('')
				.mockResolvedValueOnce('');

			await ui.showManagementUI();

			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" added and started'
			);
		});
	});

	describe('toggleServer', () => {
		it('should enable disabled server', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(check) Enable' });

			await ui.showManagementUI();

			expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith('server1', {
				enabled: true,
			});
			expect(mockMcpManager.startServer).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" enabled and started'
			);
		});

		it('should disable enabled server', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(circle-slash) Disable' });

			await ui.showManagementUI();

			expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith('server1', {
				enabled: false,
			});
			expect(mockMcpManager.stopServer).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" disabled and stopped'
			);
		});
	});

	describe('editServer', () => {
		it('should update server configuration', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'old-cmd',
				args: ['old-arg'],
				env: { OLD: 'value' },
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(edit) Edit' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('new-cmd')
				.mockResolvedValueOnce('new-arg1 new-arg2')
				.mockResolvedValueOnce('NEW=value');

			await ui.showManagementUI();

			expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith('server1', {
				command: 'new-cmd',
				args: ['new-arg1', 'new-arg2'],
				env: { NEW: 'value' },
			});
		});

		it('should restart enabled server after edit', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'old-cmd',
				args: [],
				env: {},
				enabled: true,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(edit) Edit' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('new-cmd')
				.mockResolvedValueOnce('')
				.mockResolvedValueOnce('');

			await ui.showManagementUI();

			expect(mockMcpManager.stopServer).toHaveBeenCalledWith('server1');
			expect(mockMcpManager.startServer).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" updated and restarted'
			);
		});

		it('should not restart disabled server after edit', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'old-cmd',
				args: [],
				env: {},
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(edit) Edit' });
			mockWindow.showInputBox
				.mockResolvedValueOnce('new-cmd')
				.mockResolvedValueOnce('')
				.mockResolvedValueOnce('');

			await ui.showManagementUI();

			expect(mockMcpManager.stopServer).not.toHaveBeenCalled();
			expect(mockMcpManager.startServer).not.toHaveBeenCalled();
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" updated'
			);
		});
	});

	describe('restartServer', () => {
		it('should restart enabled server', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(refresh) Restart' });

			await ui.showManagementUI();

			expect(mockMcpManager.stopServer).toHaveBeenCalledWith('server1');
			expect(mockMcpManager.startServer).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" restarted'
			);
		});

		it('should warn if server is disabled', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(refresh) Restart' });

			await ui.showManagementUI();

			expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
				'Server "server1" is disabled. Enable it first.'
			);
			expect(mockMcpManager.stopServer).not.toHaveBeenCalled();
		});
	});

	describe('testServer', () => {
		it('should test enabled server connection', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			(mockMcpManager.getTools as any).mockResolvedValue([{ name: 'tool1' }, { name: 'tool2' }]);
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(debug-disconnect) Test Connection' });

			await ui.showManagementUI();

			expect(mockMcpManager.getTools).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" is responding. Available tools: 2'
			);
		});

		it('should handle connection failure', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			(mockMcpManager.getTools as any).mockRejectedValue(new Error('Connection failed'));
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(debug-disconnect) Test Connection' });

			await ui.showManagementUI();

			expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
				'MCP server "server1" connection failed: Connection failed'
			);
		});

		it('should warn if server is disabled', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(debug-disconnect) Test Connection' });

			await ui.showManagementUI();

			expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
				'Server "server1" is disabled. Enable it first.'
			);
			expect(mockMcpManager.getTools).not.toHaveBeenCalled();
		});
	});

	describe('deleteServer', () => {
		it('should delete server with confirmation', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(trash) Delete' });
			mockWindow.showWarningMessage.mockResolvedValue('Delete');

			await ui.showManagementUI();

			expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
				'Delete MCP server "server1"?',
				{ modal: true },
				'Delete'
			);
			expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith('server1');
			expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
				'MCP server "server1" deleted'
			);
		});

		it('should stop enabled server before deletion', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: true,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(check) server1' })
				.mockResolvedValueOnce({ label: '$(trash) Delete' });
			mockWindow.showWarningMessage.mockResolvedValue('Delete');

			await ui.showManagementUI();

			expect(mockMcpManager.stopServer).toHaveBeenCalledWith('server1');
			expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith('server1');
		});

		it('should cancel deletion if not confirmed', async () => {
			(mockConfigManager.getMcpServer as any).mockReturnValue({
				name: 'server1',
				command: 'cmd1',
				enabled: false,
			});
			mockWindow.showQuickPick
				.mockResolvedValueOnce({ label: '$(circle-slash) server1' })
				.mockResolvedValueOnce({ label: '$(trash) Delete' });
			mockWindow.showWarningMessage.mockResolvedValue(undefined);

			await ui.showManagementUI();

			expect(mockConfigManager.removeMcpServer).not.toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		it('should dispose status bar item', () => {
			ui.dispose();
			expect(mockStatusBarItem.dispose).toHaveBeenCalled();
		});
	});
});

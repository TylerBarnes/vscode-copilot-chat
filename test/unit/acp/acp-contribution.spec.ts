/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ACPContribution } from '../../../src/platform/acp/acp.contribution';

// Mock vscode module
vi.mock('vscode', () => ({
	workspace: {
		getConfiguration: vi.fn()
	},
	Disposable: class {
		dispose() {}
	}
}));

describe('ACPContribution', () => {
	let mockInstantiationService: any;
	let mockLogService: any;
	let mockAgentConfigManager: any;
	let mockFileSystemHandler: any;
	let mockTerminalManager: any;
	let mockPermissionHandler: any;
	let mockSessionManager: any;
	let mockContentBlockMapper: any;
	let mockToolCallHandler: any;
	let mockAgentPlanViewer: any;
	let mockThinkingStepsDisplay: any;
	let mockSessionModeSwitcher: any;
	let mockSlashCommandProvider: any;
	let mockMCPManager: any;
	let mockACPClient: any;
	let mockRequestHandler: any;
	let mockChatParticipant: any;
	let mockConfig: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Mock configuration
		mockConfig = {
			get: vi.fn((key: string, defaultValue?: any) => {
				if (key === 'mcpServers') {
					return {
						'test-server': {
							command: 'test-mcp',
							args: ['--port', '8080'],
							env: { TEST: 'value' }
						}
					};
				}
				return defaultValue;
			})
		};

		(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

		// Mock component instances
		mockAgentConfigManager = {
			getActiveProfile: vi.fn(() => ({
				id: 'test-agent',
				name: 'Test Agent',
				command: 'test-agent',
				args: ['--mode', 'test']
			}))
		};

		mockFileSystemHandler = { dispose: vi.fn() };
		mockTerminalManager = { dispose: vi.fn() };
		mockPermissionHandler = { dispose: vi.fn() };
		mockSessionManager = { dispose: vi.fn() };
		mockContentBlockMapper = { dispose: vi.fn() };
		mockToolCallHandler = { dispose: vi.fn() };
		mockAgentPlanViewer = { dispose: vi.fn() };
		mockThinkingStepsDisplay = { dispose: vi.fn() };
		mockSessionModeSwitcher = { dispose: vi.fn() };
		mockSlashCommandProvider = { dispose: vi.fn() };

		mockMCPManager = {
			startServer: vi.fn().mockResolvedValue(undefined),
			dispose: vi.fn()
		};

		mockACPClient = {
			dispose: vi.fn()
		};

		mockRequestHandler = {
			dispose: vi.fn()
		};

		mockChatParticipant = {
			dispose: vi.fn()
		};

		// Mock instantiation service
		mockInstantiationService = {
			createInstance: vi.fn((ctor: any, ...args: any[]) => {
				if (ctor.name === 'AgentConfigManager') return mockAgentConfigManager;
				if (ctor.name === 'FileSystemHandler') return mockFileSystemHandler;
				if (ctor.name === 'TerminalManager') return mockTerminalManager;
				if (ctor.name === 'PermissionHandler') return mockPermissionHandler;
				if (ctor.name === 'SessionManager') return mockSessionManager;
				if (ctor.name === 'ContentBlockMapper') return mockContentBlockMapper;
				if (ctor.name === 'ToolCallHandler') return mockToolCallHandler;
				if (ctor.name === 'AgentPlanViewer') return mockAgentPlanViewer;
				if (ctor.name === 'ThinkingStepsDisplay') return mockThinkingStepsDisplay;
				if (ctor.name === 'SessionModeSwitcher') return mockSessionModeSwitcher;
				if (ctor.name === 'SlashCommandProvider') return mockSlashCommandProvider;
				if (ctor.name === 'MCPManager') return mockMCPManager;
				if (ctor.name === 'ACPClient') return mockACPClient;
				if (ctor.name === 'ACPRequestHandler') return mockRequestHandler;
				if (ctor.name === 'ACPChatParticipant') return mockChatParticipant;
				return {};
			})
		};

		mockLogService = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			trace: vi.fn()
		};
	});

	describe('initialization', () => {
		it('should initialize all core components', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'AgentConfigManager' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'FileSystemHandler' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'TerminalManager' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'PermissionHandler' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'SessionManager' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ContentBlockMapper' })
			);
			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'MCPManager' })
			);

			contribution.dispose();
		});

		it('should start configured MCP servers', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockMCPManager.startServer).toHaveBeenCalledWith(
				'test-server',
				'test-mcp',
				['--port', '8080'],
				{ TEST: 'value' }
			);

			contribution.dispose();
		});

		it('should create ACP client with active agent profile', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ACPClient' }),
				'test-agent',
				['--mode', 'test']
			);

			contribution.dispose();
		});

		it('should create request handler with all dependencies', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ACPRequestHandler' }),
				mockACPClient,
				mockContentBlockMapper,
				mockToolCallHandler,
				mockPermissionHandler,
				mockAgentPlanViewer,
				mockThinkingStepsDisplay,
				mockSessionModeSwitcher,
				mockSlashCommandProvider
			);

			contribution.dispose();
		});

		it('should create and register chat participant', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ACPChatParticipant' }),
				mockRequestHandler,
				mockSessionManager
			);

			contribution.dispose();
		});

		it('should log initialization steps', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Initializing ACP contribution');
			expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Using agent profile: Test Agent');
			expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Starting MCP server: test-server');
			expect(mockLogService.info).toHaveBeenCalledWith('[ACP] ACP contribution initialized successfully');

			contribution.dispose();
		});
	});

	describe('error handling', () => {
		it('should handle missing active agent profile', async () => {
			mockAgentConfigManager.getActiveProfile.mockReturnValue(null);

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockLogService.warn).toHaveBeenCalledWith('[ACP] No active agent profile configured');
			expect(mockInstantiationService.createInstance).not.toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ACPClient' })
			);

			contribution.dispose();
		});

		it('should handle MCP server startup errors', async () => {
			const error = new Error('Server startup failed');
			mockMCPManager.startServer.mockRejectedValue(error);

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockLogService.error).toHaveBeenCalledWith(
				'[ACP] Failed to start MCP server test-server',
				error
			);

			contribution.dispose();
		});

	it('should handle initialization errors', async () => {
		const error = new Error('Initialization failed');
		mockInstantiationService.createInstance.mockImplementation(() => {
			throw error;
		});

		const contribution = new ACPContribution(mockInstantiationService, mockLogService);

		// Wait for async initialization to complete
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(mockLogService.error).toHaveBeenCalledWith(
			'[ACP] Failed to initialize ACP contribution',
			error
		);

		contribution.dispose();
	});
	});

	describe('MCP server management', () => {
		it('should start multiple MCP servers', async () => {
			mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
				if (key === 'mcpServers') {
					return {
						'server1': { command: 'mcp1', args: ['--port', '8080'] },
						'server2': { command: 'mcp2', args: ['--port', '8081'] }
					};
				}
				return defaultValue;
			});

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockMCPManager.startServer).toHaveBeenCalledWith('server1', 'mcp1', ['--port', '8080'], undefined);
			expect(mockMCPManager.startServer).toHaveBeenCalledWith('server2', 'mcp2', ['--port', '8081'], undefined);

			contribution.dispose();
		});

		it('should handle empty MCP server configuration', async () => {
			mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
				if (key === 'mcpServers') {
					return {};
				}
				return defaultValue;
			});

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockMCPManager.startServer).not.toHaveBeenCalled();

			contribution.dispose();
		});

		it('should pass environment variables to MCP servers', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockMCPManager.startServer).toHaveBeenCalledWith(
				'test-server',
				'test-mcp',
				['--port', '8080'],
				{ TEST: 'value' }
			);

			contribution.dispose();
		});
	});

	describe('disposal', () => {
		it('should dispose all components', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			contribution.dispose();

			expect(mockMCPManager.dispose).toHaveBeenCalled();
			expect(mockACPClient.dispose).toHaveBeenCalled();
			expect(mockChatParticipant.dispose).toHaveBeenCalled();
			expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Disposing ACP contribution');
		});

		it('should handle disposal when not fully initialized', () => {
			mockAgentConfigManager.getActiveProfile.mockReturnValue(null);

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			expect(() => contribution.dispose()).not.toThrow();
		});

		it('should clear disposables array', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			contribution.dispose();

			// Disposing again should not throw
			expect(() => contribution.dispose()).not.toThrow();
		});
	});

	describe('configuration', () => {
		it('should read ACP configuration', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('acp');
			expect(mockConfig.get).toHaveBeenCalledWith('mcpServers', {});

			contribution.dispose();
		});

		it('should use active agent profile from config manager', async () => {
			const customProfile = {
				id: 'custom-agent',
				name: 'Custom Agent',
				command: 'custom-cmd',
				args: ['--custom']
			};
			mockAgentConfigManager.getActiveProfile.mockReturnValue(customProfile);

			const contribution = new ACPContribution(mockInstantiationService, mockLogService);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockInstantiationService.createInstance).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'ACPClient' }),
				'custom-cmd',
				['--custom']
			);

			contribution.dispose();
		});
	});
});

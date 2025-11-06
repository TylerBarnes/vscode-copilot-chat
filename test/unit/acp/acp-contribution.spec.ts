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
        getConfiguration: vi.fn(),
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' },
            name: 'test-workspace',
            index: 0
        }],
        fs: {
            stat: vi.fn(async () => ({ type: 2 })), // 2 = Directory
            createDirectory: vi.fn(async () => {}),
            readFile: vi.fn(async () => Buffer.from('{}')),
            writeFile: vi.fn(async () => {})
        }
    },
    window: {
        registerWebviewViewProvider: vi.fn(() => ({
            dispose: vi.fn()
        })),
        showWarningMessage: vi.fn(async () => undefined)
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        joinPath: vi.fn((base: any, ...segments: string[]) => ({
            fsPath: `${base.fsPath}/${segments.join('/')}`
        }))
    },
    Disposable: class {
        dispose() {}
    }
}));

// Mock child_process module
vi.mock('child_process', () => ({
    spawn: vi.fn(() => {
        const EventEmitter = require('events');
        const mockProcess = new EventEmitter();
        (mockProcess as any).stdin = {
            write: vi.fn(),
            end: vi.fn()
        };
        (mockProcess as any).stdout = new EventEmitter();
        (mockProcess as any).stderr = new EventEmitter();
        (mockProcess as any).pid = 12345;
        (mockProcess as any).kill = vi.fn();
        return mockProcess;
    })
}));

// Mock AgentConfigManager
vi.mock('../../../src/platform/acp/agent-config', () => ({
    AgentConfigManager: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(async () => {}),
        getActiveProfile: vi.fn(() => ({
            id: 'test-agent',
            name: 'Test Agent',
            executable: 'test-agent',
            args: ['--mode', 'test']
        })),
        getAllProfiles: vi.fn(() => []),
        addProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
        setActiveProfile: vi.fn()
    }))
}));

describe('ACPContribution', () => {
    let mockInstantiationService: any;
    let mockLogService: any;
    let mockExtensionContext: any;
    let mockUri: any;
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
            initialize: vi.fn().mockResolvedValue(undefined),
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

        // Mock URI
        mockUri = {
            fsPath: '/mock/extension/path',
            with: vi.fn()
        };

        // Mock extension context
        mockExtensionContext = {
            extensionUri: mockUri,
            globalStorageUri: {
                fsPath: '/mock/global/storage'
            },
            subscriptions: []
        };
    });

    describe('initialization', () => {
        it('should initialize all core components', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify that createInstance was called for each component
            // Note: We check by function reference, not by name property
            const calls = (mockInstantiationService.createInstance as any).mock.calls;
            
            // Should have created: TerminalManager, 
            // ToolCallHandler, MCPManager, ACPClient, ACPRequestHandler, ACPChatParticipant
            // (AgentConfigManager, FileSystemHandler, and SessionManager are now directly instantiated, not via createInstance)
            expect(calls.length).toBeGreaterThanOrEqual(6);

            contribution.dispose();
        });

        it('should start configured MCP servers', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockMCPManager.startServer).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test-server',
                    command: 'test-mcp',
                    args: ['--port', '8080'],
                    env: { TEST: 'value' },
                    transport: 'stdio'
                })
            );

            contribution.dispose();
        });

        it('should create ACP client with active agent profile', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify ACPClient was created with a ChildProcess (spawned agent)
            const acpClientCall = (mockInstantiationService.createInstance as any).mock.calls.find(
                (call: any) => call[0]?.name === 'ACPClient' || call[0]?.constructor?.name === 'ACPClient'
            );
            expect(acpClientCall).toBeDefined();
            expect(acpClientCall[1]).toHaveProperty('stdin');
            expect(acpClientCall[1]).toHaveProperty('stdout');
            expect(acpClientCall[1]).toHaveProperty('stderr');

            contribution.dispose();
        });

        it('should create request handler with all dependencies', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify ACPRequestHandler was created with ACPClient
            const requestHandlerCall = (mockInstantiationService.createInstance as any).mock.calls.find(
                (call: any) => call[0]?.name === 'ACPRequestHandler' || call[0]?.constructor?.name === 'ACPRequestHandler'
            );
            expect(requestHandlerCall).toBeDefined();
            expect(requestHandlerCall[1]).toBe(mockACPClient);

            contribution.dispose();
        });

        it('should create and register chat participant', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that ACPChatParticipant was created with correct dependencies
            const chatParticipantCall = mockInstantiationService.createInstance.mock.calls.find((call: any[]) => 
                call.length === 4 && 
                call[1] === mockACPClient &&
                call[2] === mockRequestHandler &&
                call[3] && typeof call[3].createSession === 'function' // SessionManager instance
            );
            expect(chatParticipantCall).toBeDefined();

            contribution.dispose();
        });

it('should log initialization steps', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that the expected log messages were called (in any order due to async nature)
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Initializing ACP contribution');
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Starting MCP server: test-server');
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Using agent profile: Test Agent');
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Initializing ACP client...');
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] ACP client initialized successfully');
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] ACP contribution initialized successfully');

            contribution.dispose();
        });
	});

    describe('error handling', () => {
        it('should handle missing active agent profile', async () => {
            // Mock AgentConfigManager to return null for this test
            const { AgentConfigManager } = await import('../../../src/platform/acp/agent-config');
            vi.mocked(AgentConfigManager).mockImplementationOnce(() => ({
                initialize: vi.fn(async () => {}),
                getActiveProfile: vi.fn(() => null),
                getAllProfiles: vi.fn(() => []),
                addProfile: vi.fn(),
                updateProfile: vi.fn(),
                deleteProfile: vi.fn(),
                setActiveProfile: vi.fn()
            } as any));

            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockLogService.warn).toHaveBeenCalledWith(
                expect.stringContaining('No active agent profile configured')
            );
            expect(mockInstantiationService.createInstance).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'ACPClient' })
            );

            contribution.dispose();
        });

		it('should handle MCP server startup errors', async () => {
			const error = new Error('Server startup failed');
			mockMCPManager.startServer.mockRejectedValue(error);

			const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

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

		const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

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

			const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockMCPManager.startServer).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'server1',
                    command: 'mcp1',
                    args: ['--port', '8080'],
                    transport: 'stdio'
                })
            );
            expect(mockMCPManager.startServer).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'server2',
                    command: 'mcp2',
                    args: ['--port', '8081'],
                    transport: 'stdio'
                })
            );

			contribution.dispose();
		});

		it('should handle empty MCP server configuration', async () => {
			mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
				if (key === 'mcpServers') {
					return {};
				}
				return defaultValue;
			});

			const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockMCPManager.startServer).not.toHaveBeenCalled();

			contribution.dispose();
		});

        it('should pass environment variables to MCP servers', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockMCPManager.startServer).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test-server',
                    command: 'test-mcp',
                    args: ['--port', '8080'],
                    env: { TEST: 'value' },
                    transport: 'stdio'
                })
            );

            contribution.dispose();
        });
	});

	describe('disposal', () => {
it('should dispose all components', async () => {
            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            contribution.dispose();

            expect(mockMCPManager.dispose).toHaveBeenCalled();
            expect(mockACPClient.dispose).toHaveBeenCalled();
            expect(mockLogService.info).toHaveBeenCalledWith('[ACP] Disposing ACP contribution');
        });

        it('should handle disposal when not fully initialized', async () => {
            // Mock AgentConfigManager to return null for this test
            const { AgentConfigManager } = await import('../../../src/platform/acp/agent-config');
            vi.mocked(AgentConfigManager).mockImplementationOnce(() => ({
                getActiveProfile: vi.fn(() => null),
                getAllProfiles: vi.fn(() => []),
                addProfile: vi.fn(),
                updateProfile: vi.fn(),
                deleteProfile: vi.fn(),
                setActiveProfile: vi.fn()
            } as any));

            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(() => contribution.dispose()).not.toThrow();
        });

		it('should clear disposables array', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

			// Wait for async initialization
			await new Promise(resolve => setTimeout(resolve, 10));

			contribution.dispose();

			// Disposing again should not throw
			expect(() => contribution.dispose()).not.toThrow();
		});
	});

	describe('configuration', () => {
		it('should read ACP configuration', async () => {
			const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

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
                executable: 'custom-cmd',
                args: ['--custom']
            };
            
            // Mock AgentConfigManager to return custom profile for this test
            const { AgentConfigManager } = await import('../../../src/platform/acp/agent-config');
            vi.mocked(AgentConfigManager).mockImplementationOnce(() => ({
                initialize: vi.fn(async () => {}),
                getActiveProfile: vi.fn(() => customProfile),
                getAllProfiles: vi.fn(() => [customProfile]),
                addProfile: vi.fn(),
                updateProfile: vi.fn(),
                deleteProfile: vi.fn(),
                setActiveProfile: vi.fn()
            } as any));

            const contribution = new ACPContribution(mockInstantiationService, mockLogService, mockExtensionContext);

            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify ACPClient was created with a spawned process using the custom profile
            const acpClientCall = (mockInstantiationService.createInstance as any).mock.calls.find(
                (call: any) => call[0]?.name === 'ACPClient' || call[0]?.constructor?.name === 'ACPClient'
            );
            expect(acpClientCall).toBeDefined();
            expect(acpClientCall[1]).toHaveProperty('stdin');
            expect(acpClientCall[1]).toHaveProperty('stdout');
            expect(acpClientCall[1]).toHaveProperty('stderr');

            contribution.dispose();
        });
	});
});

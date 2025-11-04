import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPManager, MCPServerConfig } from '../../../src/platform/acp/mcp-manager';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
	spawn: vi.fn()
}));

describe('MCPManager', () => {
    let manager: MCPManager;
    let mockProcess: Partial<ChildProcess>;
    let mockProcesses: Array<Partial<ChildProcess>>; // Track all mock processes

beforeEach(() => {
        manager = new MCPManager();
        mockProcesses = []; // Reset the array
        
        // Mock spawn to create a new mock process for each call
        vi.mocked(spawn).mockImplementation(() => {
            const newMockProcess: any = {
                stdin: {
                    write: vi.fn(),
                    end: vi.fn()
                },
                stdout: {
                    on: vi.fn((event: string, callback: (data: Buffer) => void) => {
                        // Store the callback for later use
                        if (event === 'data') {
                            newMockProcess.stdout._dataCallback = callback;
                        }
                    }),
                    removeAllListeners: vi.fn()
                },
                stderr: {
                    on: vi.fn((event: string, callback: (data: Buffer) => void) => {
                        // Store the callback for later use
                        if (event === 'data') {
                            newMockProcess.stderr._dataCallback = callback;
                        }
                    }),
                    removeAllListeners: vi.fn()
                },
                on: vi.fn((event: string, callback: (error?: Error, code?: number) => void) => {
                    // Store the callbacks for later use
                    if (event === 'error') {
                        newMockProcess._errorCallback = callback;
                    } else if (event === 'exit') {
                        newMockProcess._exitCallback = callback;
                    }
                }),
                kill: vi.fn(() => {
                    // Simulate process exit when killed
                    setTimeout(() => {
                        if (newMockProcess._exitCallback) {
                            newMockProcess._exitCallback(0);
                        }
                    }, 0);
                }),
                pid: 12345
            };
            
            // Store reference for tests that need it
            mockProcess = newMockProcess;
            mockProcesses.push(newMockProcess); // Track all processes
            return newMockProcess as ChildProcess;
        });
    });

	afterEach(async () => {
		await manager.dispose();
		vi.clearAllMocks();
	});

	describe('startServer', () => {
		it('should start an MCP server with stdio transport', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			await manager.startServer(config);

			expect(spawn).toHaveBeenCalledWith('node', ['server.js'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: expect.any(Object)
			});
		});

		it('should start an MCP server with custom environment variables', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio',
				env: {
					API_KEY: 'secret',
					DEBUG: 'true'
				}
			};

			await manager.startServer(config);

			expect(spawn).toHaveBeenCalledWith('node', ['server.js'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: expect.objectContaining({
					API_KEY: 'secret',
					DEBUG: 'true'
				})
			});
		});

		it('should throw if server with same name already exists', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			await manager.startServer(config);

			await expect(manager.startServer(config)).rejects.toThrow(
				'MCP server "test-server" is already running'
			);
		});

        it('should handle server startup errors', async () => {
            const config: MCPServerConfig = {
                name: 'test-server',
                command: 'nonexistent-command',
                args: [],
                transport: 'stdio'
            };

            // startServer should succeed even if the process errors later
            await manager.startServer(config);
            
            // Simulate process error
            setTimeout(() => {
                mockProcess._errorCallback?.(new Error('Command not found'));
            }, 10);
            
            // Wait a bit for the error to be processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Server should be removed from the running servers list
            expect(manager.getRunningServers()).not.toContain('test-server');
        });

		it('should track multiple servers', async () => {
			const config1: MCPServerConfig = {
				name: 'server-1',
				command: 'node',
				args: ['server1.js'],
				transport: 'stdio'
			};

			const config2: MCPServerConfig = {
				name: 'server-2',
				command: 'node',
				args: ['server2.js'],
				transport: 'stdio'
			};

			await manager.startServer(config1);
			await manager.startServer(config2);

			const servers = manager.getRunningServers();
			expect(servers).toHaveLength(2);
			expect(servers).toContain('server-1');
			expect(servers).toContain('server-2');
		});
	});

	describe('stopServer', () => {
		it('should stop a running server', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			await manager.startServer(config);
			await manager.stopServer('test-server');

			expect(mockProcess.kill).toHaveBeenCalled();
			expect(manager.getRunningServers()).not.toContain('test-server');
		});

		it('should handle stopping non-existent server gracefully', async () => {
			await expect(manager.stopServer('nonexistent')).resolves.toBeUndefined();
		});

		it('should wait for process to exit', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			let exitCallback: ((code: number) => void) | undefined;
			mockProcess.on = vi.fn((event, callback) => {
				if (event === 'exit') {
					exitCallback = callback as any;
				}
				return mockProcess as any;
			});

			await manager.startServer(config);

			// Simulate async stop
			const stopPromise = manager.stopServer('test-server');
			
			// Simulate process exit after a delay
			setTimeout(() => exitCallback?.(0), 10);

			await stopPromise;
			expect(manager.getRunningServers()).not.toContain('test-server');
		});
	});

	describe('getRunningServers', () => {
		it('should return empty array when no servers are running', () => {
			expect(manager.getRunningServers()).toEqual([]);
		});

		it('should return list of running server names', async () => {
			const configs: MCPServerConfig[] = [
				{ name: 'server-1', command: 'node', args: ['s1.js'], transport: 'stdio' },
				{ name: 'server-2', command: 'node', args: ['s2.js'], transport: 'stdio' },
				{ name: 'server-3', command: 'node', args: ['s3.js'], transport: 'stdio' }
			];

			for (const config of configs) {
				await manager.startServer(config);
			}

			const servers = manager.getRunningServers();
			expect(servers).toHaveLength(3);
			expect(servers).toEqual(['server-1', 'server-2', 'server-3']);
		});
	});

	describe('getServerConfig', () => {
		it('should return server configuration', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio',
				env: { KEY: 'value' }
			};

			await manager.startServer(config);

			const retrievedConfig = manager.getServerConfig('test-server');
			expect(retrievedConfig).toEqual(config);
		});

		it('should return undefined for non-existent server', () => {
			expect(manager.getServerConfig('nonexistent')).toBeUndefined();
		});
	});

	describe('sendMessage', () => {
		it('should send JSON-RPC message to server', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			await manager.startServer(config);

			const message = {
				jsonrpc: '2.0',
				method: 'tools/list',
				id: 1
			};

			await manager.sendMessage('test-server', message);

            expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
                JSON.stringify(message) + '\n'
            );
		});

		it('should throw if server is not running', async () => {
			const message = { jsonrpc: '2.0', method: 'test', id: 1 };

			await expect(manager.sendMessage('nonexistent', message)).rejects.toThrow(
				'MCP server "nonexistent" is not running'
			);
		});
	});

	describe('onMessage', () => {



		it('should ignore invalid JSON', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			let stdoutCallback: ((data: Buffer) => void) | undefined;
			mockProcess.stdout!.on = vi.fn((event, callback) => {
				if (event === 'data') {
					stdoutCallback = callback as any;
				}
				return mockProcess.stdout as any;
			});

			await manager.startServer(config);

			const messageCallback = vi.fn();
			manager.onMessage('test-server', messageCallback);

            // Send invalid JSON
            stdoutCallback?.(Buffer.from('invalid json\
'));

			expect(messageCallback).not.toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		it('should stop all running servers', async () => {
			const configs: MCPServerConfig[] = [
				{ name: 'server-1', command: 'node', args: ['s1.js'], transport: 'stdio' },
				{ name: 'server-2', command: 'node', args: ['s2.js'], transport: 'stdio' }
			];

			for (const config of configs) {
				await manager.startServer(config);
			}

            await manager.dispose();

            // Check that both processes were killed
            expect(mockProcesses[0].kill).toHaveBeenCalled();
            expect(mockProcesses[1].kill).toHaveBeenCalled();
            expect(manager.getRunningServers()).toEqual([]);
		});

		it('should be safe to call multiple times', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

			await manager.startServer(config);
			await manager.dispose();
			await manager.dispose();

			expect(manager.getRunningServers()).toEqual([]);
		});
	});

	describe('restartServer', () => {
		it('should restart a running server', async () => {
			const config: MCPServerConfig = {
				name: 'test-server',
				command: 'node',
				args: ['server.js'],
				transport: 'stdio'
			};

            await manager.startServer(config);
            
            // Store reference to the first process
            const firstProcess = mockProcesses[0];
            
            // Clear the mock to track restart calls
            vi.mocked(spawn).mockClear();

            await manager.restartServer('test-server');

            expect(firstProcess.kill).toHaveBeenCalled();
            expect(spawn).toHaveBeenCalledWith('node', ['server.js'], expect.any(Object));
            expect(manager.getRunningServers()).toContain('test-server');
		});

		it('should throw if server is not running', async () => {
			await expect(manager.restartServer('nonexistent')).rejects.toThrow(
				'MCP server "nonexistent" is not running'
			);
		});
	});
});

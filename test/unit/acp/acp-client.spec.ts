import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';
import { ACPClient } from '../../../src/platform/acp/acp-client';
import type { 
    SessionUpdateNotification,
    ToolCallKind,
    ToolCallStatus
} from '../../../src/platform/acp/types';

describe('ACPClient', () => {
    let mockStdin: Writable;
    let mockStdout: Readable;
    let mockProcess: any;
    let client: ACPClient;
    let stdoutEmitter: EventEmitter;

    beforeEach(() => {
        // Create mock streams
        const mockWrite = vi.fn((chunk, encoding, callback) => {
            callback?.();
        });
        
        mockStdin = new Writable({
            write: mockWrite
        }) as any;
        
        // Store the mock write function for assertions
        (mockStdin as any).write = mockWrite;

        stdoutEmitter = new EventEmitter();
        mockStdout = Object.assign(stdoutEmitter, {
            readable: true,
            read: vi.fn(),
            setEncoding: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            isPaused: vi.fn(),
            pipe: vi.fn(),
            unpipe: vi.fn(),
            unshift: vi.fn(),
            wrap: vi.fn(),
            destroy: vi.fn(),
            [Symbol.asyncIterator]: vi.fn()
        }) as any;

        // Mock child process
        mockProcess = {
            stdin: mockStdin,
            stdout: mockStdout,
            stderr: new EventEmitter(),
            kill: vi.fn(),
            pid: 12345,
            on: vi.fn(),
            removeListener: vi.fn()
        };
    });

    afterEach(() => {
        if (client) {
            client.dispose();
        }
    });

    describe('initialization', () => {
        it('should initialize the agent with correct parameters', async () => {
            client = new ACPClient(mockProcess);
            
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
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
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            // Simulate agent response
            setTimeout(() => {
                const response = {
                    jsonrpc: '2.0',
                    id: 1,
                    result: {
                        protocolVersion: '0.1.0',
                        agentCapabilities: {
                            loadSession: true,
                            promptCapabilities: {
                                image: false,
                                audio: false,
                                embeddedContext: true
                            }
                        },
                        agentInfo: {
                            name: 'test-agent',
                            version: '1.0.0'
                        }
                    }
                };
                stdoutEmitter.emit('data', JSON.stringify(response) + '\n');
            }, 10);

            const result = await initPromise;
            expect(result.protocolVersion).toBe('0.1.0');
            expect(result.agentCapabilities.loadSession).toBe(true);
            expect(result.agentInfo?.name).toBe('test-agent');
        });

        it('should handle initialization errors', async () => {
            client = new ACPClient(mockProcess);
            
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {},
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            // Simulate error response
            setTimeout(() => {
                const response = {
                    jsonrpc: '2.0',
                    id: 1,
                    error: {
                        code: -32600,
                        message: 'Invalid protocol version'
                    }
                };
                stdoutEmitter.emit('data', JSON.stringify(response) + '\n');
            }, 10);

            await expect(initPromise).rejects.toThrow('Invalid protocol version');
        });
    });

    describe('session management', () => {
        beforeEach(async () => {
            client = new ACPClient(mockProcess);
            
            // Initialize first
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {},
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            setTimeout(() => {
                const response = {
                    jsonrpc: '2.0',
                    id: 1,
                    result: {
                        protocolVersion: '0.1.0',
                        agentCapabilities: {}
                    }
                };
                stdoutEmitter.emit('data', JSON.stringify(response) + '\n');
            }, 10);

            await initPromise;
        });

        it('should create a new session', async () => {
            const sessionPromise = client.newSession({
                cwd: '/test/workspace',
                mcpServers: []
            });

            setTimeout(() => {
                const response = {
                    jsonrpc: '2.0',
                    id: 2,
                    result: {
                        sessionId: 'session-123'
                    }
                };
                stdoutEmitter.emit('data', JSON.stringify(response) + '\n');
            }, 10);

            const result = await sessionPromise;
            expect(result.sessionId).toBe('session-123');
        });

        it('should load an existing session', async () => {
            // Assume agent has loadSession capability
            client['agentCapabilities'] = { loadSession: true };

            const loadPromise = client.loadSession({
                sessionId: 'session-123'
            });

            setTimeout(() => {
                const response = {
                    jsonrpc: '2.0',
                    id: 2,
                    result: {}
                };
                stdoutEmitter.emit('data', JSON.stringify(response) + '\n');
            }, 10);

            await expect(loadPromise).resolves.toEqual({});
        });

        it('should throw error when loading session without capability', async () => {
            // Agent doesn't have loadSession capability
            client['agentCapabilities'] = { loadSession: false };

            await expect(client.loadSession({ sessionId: 'session-123' }))
                .rejects.toThrow('Agent does not support loading sessions');
        });
    });

    describe('prompt execution', () => {
        beforeEach(async () => {
            client = new ACPClient(mockProcess);
            
            // Initialize and create session
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {},
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    result: { protocolVersion: '0.1.0', agentCapabilities: {} }
                }) + '\n');
            }, 10);

            await initPromise;

            const sessionPromise = client.newSession({
                cwd: '/test/workspace',
                mcpServers: []
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    result: { sessionId: 'session-123' }
                }) + '\n');
            }, 10);

            await sessionPromise;
        });

        it('should send a prompt and handle streaming response', async () => {
            const updates: SessionUpdateNotification[] = [];
            
            client.onSessionUpdate((update) => {
                updates.push(update);
            });

            const promptPromise = client.prompt({
                sessionId: 'session-123',
                prompt: [
                    { type: 'text', text: 'Hello, agent!' }
                ]
            });

            // Simulate streaming response
            setTimeout(() => {
                // First, send a message chunk
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'session/update',
                    params: {
                        sessionId: 'session-123',
                        sessionUpdate: 'agent_message_chunk',
                        content: 'Hello, '
                    }
                }) + '\n');

                // Send another chunk
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'session/update',
                    params: {
                        sessionId: 'session-123',
                        sessionUpdate: 'agent_message_chunk',
                        content: 'human!'
                    }
                }) + '\n');

                // Send completion
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    result: {
                        stopReason: 'end_turn'
                    }
                }) + '\n');
            }, 10);

            const result = await promptPromise;
            expect(result.stopReason).toBe('end_turn');
            expect(updates).toHaveLength(2);
            expect((updates[0] as any).content).toBe('Hello, ');
            expect((updates[1] as any).content).toBe('human!');
        });

        it('should handle tool calls in prompt response', async () => {
            const updates: SessionUpdateNotification[] = [];
            
            client.onSessionUpdate((update) => {
                updates.push(update);
            });

            const promptPromise = client.prompt({
                sessionId: 'session-123',
                prompt: [
                    { type: 'text', text: 'Read the file test.txt' }
                ]
            });

            setTimeout(() => {
                // Send tool call notification
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'session/update',
                    params: {
                        sessionId: 'session-123',
                        sessionUpdate: 'tool_call',
                        toolCallId: 'tool-1',
                        title: 'Reading test.txt',
                        kind: 'read' as ToolCallKind,
                        status: 'pending' as ToolCallStatus
                    }
                }) + '\n');

                // Update tool status
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'session/update',
                    params: {
                        sessionId: 'session-123',
                        sessionUpdate: 'tool_call_update',
                        toolCallId: 'tool-1',
                        status: 'completed' as ToolCallStatus,
                        content: 'File contents here'
                    }
                }) + '\n');

                // Complete the prompt
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    result: {
                        stopReason: 'end_turn'
                    }
                }) + '\n');
            }, 10);

            const result = await promptPromise;
            expect(result.stopReason).toBe('end_turn');
            
            const toolCall = updates.find(u => u.sessionUpdate === 'tool_call');
            expect(toolCall?.toolCallId).toBe('tool-1');
            expect(toolCall?.kind).toBe('read');
            
            const toolUpdate = updates.find(u => u.sessionUpdate === 'tool_call_update');
            expect(toolUpdate?.status).toBe('completed');
            expect(toolUpdate?.content).toBe('File contents here');
        });
    });

    describe('client-implemented methods', () => {
        beforeEach(async () => {
            client = new ACPClient(mockProcess);
            
            // Initialize
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {
                    fs: {
                        readTextFile: true,
                        writeTextFile: true
                    }
                },
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    result: { protocolVersion: '0.1.0', agentCapabilities: {} }
                }) + '\n');
            }, 10);

            await initPromise;
        });

        it('should handle fs/read_text_file requests', async () => {
            const fileHandler = vi.fn().mockResolvedValue({
                content: 'file contents',
                encoding: 'utf-8'
            });

            client.onReadTextFile(fileHandler);

            // Simulate agent requesting file read
            stdoutEmitter.emit('data', JSON.stringify({
                jsonrpc: '2.0',
                id: 100,
                method: 'fs/read_text_file',
                params: {
                    path: '/test/file.txt'
                }
            }) + '\n');

            // Wait for handler to be called
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(fileHandler).toHaveBeenCalledWith({
                path: '/test/file.txt'
            });

            // Check that response was sent
            const writeCall = (mockStdin.write as any).mock.calls.find((call: any) => {
                const data = JSON.parse(call[0]);
                return data.id === 100 && data.result?.content === 'file contents';
            });
            expect(writeCall).toBeDefined();
        });

        it('should handle fs/write_text_file requests', async () => {
            const writeHandler = vi.fn().mockResolvedValue({});

            client.onWriteTextFile(writeHandler);

            // Simulate agent requesting file write
            stdoutEmitter.emit('data', JSON.stringify({
                jsonrpc: '2.0',
                id: 101,
                method: 'fs/write_text_file',
                params: {
                    path: '/test/file.txt',
                    content: 'new content'
                }
            }) + '\n');

            // Wait for handler to be called
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(writeHandler).toHaveBeenCalledWith({
                path: '/test/file.txt',
                content: 'new content'
            });

            // Check that response was sent
            const writeCall = (mockStdin.write as any).mock.calls.find((call: any) => {
                const data = JSON.parse(call[0]);
                return data.id === 101 && data.result !== undefined;
            });
            expect(writeCall).toBeDefined();
        });

        it('should handle session/request_permission requests', async () => {
            const permissionHandler = vi.fn().mockResolvedValue({
                decision: 'allow_once'
            });

            client.onRequestPermission(permissionHandler);

            // Simulate agent requesting permission
            stdoutEmitter.emit('data', JSON.stringify({
                jsonrpc: '2.0',
                id: 102,
                method: 'session/request_permission',
                params: {
                    sessionId: 'session-123',
                    toolCallId: 'tool-1',
                    title: 'Execute command',
                    kind: 'execute' as ToolCallKind
                }
            }) + '\n');

            // Wait for handler to be called
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(permissionHandler).toHaveBeenCalledWith({
                sessionId: 'session-123',
                toolCallId: 'tool-1',
                title: 'Execute command',
                kind: 'execute'
            });

            // Check that response was sent
            const writeCall = (mockStdin.write as any).mock.calls.find((call: any) => {
                const data = JSON.parse(call[0]);
                return data.id === 102 && data.result?.decision === 'allow_once';
            });
            expect(writeCall).toBeDefined();
        });
    });

    describe('cancellation', () => {
        beforeEach(async () => {
            client = new ACPClient(mockProcess);
            
            // Initialize and create session
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {},
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    result: { protocolVersion: '0.1.0', agentCapabilities: {} }
                }) + '\n');
            }, 10);

            await initPromise;

            const sessionPromise = client.newSession({
                cwd: '/test/workspace',
                mcpServers: []
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    result: { sessionId: 'session-123' }
                }) + '\n');
            }, 10);

            await sessionPromise;
        });

        it('should cancel an ongoing prompt', async () => {
            const promptPromise = client.prompt({
                sessionId: 'session-123',
                prompt: [
                    { type: 'text', text: 'Long running task' }
                ]
            });

            // Cancel after a short delay
            setTimeout(() => {
                client.cancelSession('session-123');
            }, 20);

            // Simulate agent acknowledging cancellation
            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    result: {
                        stopReason: 'cancelled'
                    }
                }) + '\n');
            }, 30);

            const result = await promptPromise;
            expect(result.stopReason).toBe('cancelled');

            // Check that cancel notification was sent
            const writeCall = (mockStdin.write as any).mock.calls.find((call: any) => {
                const data = JSON.parse(call[0]);
                return data.method === 'session/cancel' && data.params?.sessionId === 'session-123';
            });
            expect(writeCall).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle process exit gracefully', async () => {
            client = new ACPClient(mockProcess);
            
            const exitHandler = vi.fn();
            client.onProcessExit(exitHandler);

            // Simulate process exit
            mockProcess.on.mock.calls
                .filter((call: any) => call[0] === 'exit')
                .forEach((call: any) => call[1](1));

            expect(exitHandler).toHaveBeenCalledWith(1);
        });

        it('should handle stderr output', async () => {
            client = new ACPClient(mockProcess);
            
            const errorHandler = vi.fn();
            client.onStderr(errorHandler);

            // Simulate stderr output
            (mockProcess.stderr as EventEmitter).emit('data', Buffer.from('Error message\n'));

            expect(errorHandler).toHaveBeenCalledWith('Error message\n');
        });
    });

    describe('disposal', () => {
        it('should clean up resources on dispose', async () => {
            client = new ACPClient(mockProcess);
            
            const initPromise = client.initialize({
                protocolVersion: '0.1.0',
                clientCapabilities: {},
                clientInfo: {
                    name: 'vscode-copilot-chat',
                    version: '0.33.0'
                }
            });

            setTimeout(() => {
                stdoutEmitter.emit('data', JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    result: { protocolVersion: '0.1.0', agentCapabilities: {} }
                }) + '\n');
            }, 10);

            await initPromise;

            client.dispose();

            expect(mockProcess.kill).toHaveBeenCalled();
            
            // Ensure no more operations can be performed
            await expect(client.newSession({ cwd: '/test', mcpServers: [] }))
                .rejects.toThrow();
        });
    });
});
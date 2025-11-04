import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ACPRequestHandler } from '../../../src/platform/acp/acp-request-handler';
import { ACPClient } from '../../../src/platform/acp/acp-client';
import type * as vscode from 'vscode';
import {
    AgentMessageContent,
    ToolCall,
    ToolCallKind,
    ToolCallStatus,
    PermissionRequest,
    PermissionResponse,
    AgentPlan,
    ContentBlock,
} from '../../../src/platform/acp/types';

// Mock vscode module
const mockVscode = vi.hoisted(() => ({
    CancellationTokenSource: vi.fn(() => ({
        token: { isCancellationRequested: false, onCancellationRequested: vi.fn() },
        cancel: vi.fn(),
        dispose: vi.fn(),
    })),
    MarkdownString: vi.fn((value: string) => ({ value, isTrusted: false })),
    Uri: {
        parse: vi.fn((uri: string) => ({ toString: () => uri, fsPath: uri })),
    },
}));

vi.mock('vscode', () => mockVscode);

describe('ACPRequestHandler', () => {
    let acpClient: ACPClient;
    let stream: any;
    let token: vscode.CancellationToken;
    let handler: ACPRequestHandler;

    beforeEach(() => {
        // Mock ACPClient
        acpClient = {
            prompt: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            dispose: vi.fn(),
        } as any;

        // Mock ChatResponseStream
        stream = {
            markdown: vi.fn(),
            button: vi.fn(),
            progress: vi.fn(),
            reference: vi.fn(),
            push: vi.fn(),
        };

        // Mock CancellationToken
        token = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn(),
        } as any;

        handler = new ACPRequestHandler(acpClient);
    });

    describe('constructor', () => {
        it('should create handler with client', () => {
            expect(handler).toBeDefined();
        });
    });

    describe('handleRequest', () => {
        it('should send prompt to ACP client', async () => {
            vi.mocked(acpClient.prompt).mockResolvedValue(undefined);

            await handler.handleRequest('Hello, agent!', [], stream, token);

            expect(acpClient.prompt).toHaveBeenCalledWith({
                messages: [
                    {
                        role: 'user',
                        content: [{ type: 'text', text: 'Hello, agent!' }],
                    },
                ],
            });
        });

        it('should include references as embedded resources', async () => {
            vi.mocked(acpClient.prompt).mockResolvedValue(undefined);

            const references: vscode.ChatPromptReference[] = [
                {
                    id: 'file:///test.ts',
                    value: { uri: { fsPath: '/test.ts', scheme: 'file', path: '/test.ts' } },
                } as any,
            ];

            await handler.handleRequest('Check this file', references, stream, token);

            expect(acpClient.prompt).toHaveBeenCalledWith({
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Check this file' },
                            {
                                type: 'embedded_resource',
                                resource: {
                                    type: 'file',
                                    uri: 'file:///test.ts',
                                },
                            },
                        ],
                    },
                ],
            });
        });

        it('should return success result on completion', async () => {
            vi.mocked(acpClient.prompt).mockResolvedValue(undefined);

            const result = await handler.handleRequest('Hello', [], stream, token);

            expect(result).toEqual({
                metadata: {
                    command: undefined,
                },
            });
        });

        it('should handle cancellation', async () => {
            const cancelToken = {
                isCancellationRequested: true,
                onCancellationRequested: vi.fn(),
            } as any;

            const result = await handler.handleRequest('Hello', [], stream, cancelToken);

            expect(result).toEqual({
                errorDetails: {
                    message: 'Request cancelled',
                },
                metadata: {
                    command: undefined,
                },
            });
        });

        it('should handle errors from ACP client', async () => {
            vi.mocked(acpClient.prompt).mockRejectedValue(new Error('Agent error'));

            const result = await handler.handleRequest('Hello', [], stream, token);

            expect(result).toEqual({
                errorDetails: {
                    message: 'Agent error',
                },
                metadata: {
                    command: undefined,
                },
            });
        });
    });

    describe('handleAgentMessage', () => {
        it('should stream text content to markdown', () => {
            // Set current stream
            handler['currentStream'] = stream;

            const content: AgentMessageContent = {
                type: 'text',
                text: 'Hello from agent',
            };

            handler['handleAgentMessage'](content);

            expect(stream.markdown).toHaveBeenCalledWith('Hello from agent');
        });

        it('should handle thinking content', () => {
            // Set current stream
            handler['currentStream'] = stream;

            const content: AgentMessageContent = {
                type: 'thinking',
                thinking: 'Analyzing the request...',
            };

            handler['handleAgentMessage'](content);

            expect(stream.progress).toHaveBeenCalledWith('💭 Analyzing the request...');
        });

        it('should handle image content', () => {
            // Set current stream
            handler['currentStream'] = stream;

            const content: AgentMessageContent = {
                type: 'image',
                data: 'base64data',
                mimeType: 'image/png',
            };

            handler['handleAgentMessage'](content);

            expect(stream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('![Image](data:image/png;base64,base64data)')
            );
        });

        it('should handle embedded resource content', () => {
            // Set current stream
            handler['currentStream'] = stream;

            const content: AgentMessageContent = {
                type: 'embedded_resource',
                resource: {
                    type: 'file',
                    uri: 'file:///test.ts',
                },
            };

            handler['handleAgentMessage'](content);

            expect(stream.reference).toHaveBeenCalled();
        });
    });

    describe('handleToolCall', () => {
        it('should display tool call in progress', async () => {
            // Set current stream
            handler['currentStream'] = stream;

            const toolCall: ToolCall = {
                id: 'tool-1',
                kind: ToolCallKind.ReadTextFile,
                status: ToolCallStatus.Pending,
                input: { path: '/test.ts' },
            };

            await handler['handleToolCall'](toolCall);

            expect(stream.progress).toHaveBeenCalledWith(
                expect.stringContaining('🔧 read_text_file')
            );
        });

        it('should display tool call completion', async () => {
            // Set current stream
            handler['currentStream'] = stream;

            const toolCall: ToolCall = {
                id: 'tool-1',
                kind: ToolCallKind.ReadTextFile,
                status: ToolCallStatus.Completed,
                input: { path: '/test.ts' },
                output: { content: 'file content' },
            };

            await handler['handleToolCall'](toolCall);

            expect(stream.progress).toHaveBeenCalledWith(
                expect.stringContaining('✓ read_text_file')
            );
        });

        it('should display tool call error', async () => {
            // Set current stream
            handler['currentStream'] = stream;

            const toolCall: ToolCall = {
                id: 'tool-1',
                kind: ToolCallKind.ReadTextFile,
                status: ToolCallStatus.Error,
                input: { path: '/test.ts' },
                error: 'File not found',
            };

            await handler['handleToolCall'](toolCall);

            expect(stream.progress).toHaveBeenCalledWith(
                expect.stringContaining('✗ read_text_file')
            );
        });
    });

    describe('handlePermissionRequest', () => {
        it('should request permission from user', async () => {
            const request: PermissionRequest = {
                id: 'perm-1',
                toolCall: {
                    id: 'tool-1',
                    kind: ToolCallKind.WriteTextFile,
                    status: ToolCallStatus.AwaitingPermission,
                    input: { path: '/test.ts', content: 'new content' },
                },
            };

            // Mock user approval
            const approveCallback = vi.fn().mockResolvedValue(true);
            handler['onPermissionRequest'] = approveCallback;

            const response = await handler['handlePermissionRequest'](request);

            expect(approveCallback).toHaveBeenCalledWith(request);
            expect(response.decision).toBe('allow_once');
        });

        it('should handle user rejection', async () => {
            const request: PermissionRequest = {
                id: 'perm-1',
                toolCall: {
                    id: 'tool-1',
                    kind: ToolCallKind.WriteTextFile,
                    status: ToolCallStatus.AwaitingPermission,
                    input: { path: '/test.ts', content: 'new content' },
                },
            };

            // Mock user rejection
            const rejectCallback = vi.fn().mockResolvedValue(false);
            handler['onPermissionRequest'] = rejectCallback;

            const response = await handler['handlePermissionRequest'](request);

            expect(response.decision).toBe('reject_once');
        });
    });

    describe('handleAgentPlan', () => {
        it('should display agent plan steps', () => {
            // Set current stream
            handler['currentStream'] = stream;

            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                    { description: 'Write changes', status: 'pending' },
                ],
            };

            handler['handleAgentPlan'](plan);

            expect(stream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('🎯 Agent Plan:')
            );
            expect(stream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('✓ Read file')
            );
            expect(stream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('⏳ Analyze code')
            );
            expect(stream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('⏸️ Write changes')
            );
        });
    });

});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ACPChatParticipant } from '../../../src/platform/acp/acp-chat-participant';
import { ACPClient } from '../../../src/platform/acp/acp-client';
import { ACPRequestHandler } from '../../../src/platform/acp/acp-request-handler';
import { SessionManager } from '../../../src/platform/acp/session-manager';
import { AgentConfigManager } from '../../../src/platform/acp/agent-config';

vi.mock('vscode', () => ({
    chat: {
        createChatParticipant: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(),
    },
    Uri: {
        file: vi.fn((path: string) => ({ scheme: 'file', path })),
        parse: vi.fn((uri: string) => ({ scheme: 'file', path: uri })),
    },
    CancellationTokenSource: vi.fn(() => ({
        token: {},
        cancel: vi.fn(),
        dispose: vi.fn(),
    })),
}));

describe('ACPChatParticipant', () => {
    let chatParticipant: ACPChatParticipant;
    let mockACPClient: any;
    let mockRequestHandler: any;
    let mockSessionManager: any;
    let mockAgentConfig: any;
    let mockParticipant: any;
    
    // Store spy references separately for assertion
    let createSessionSpy: ReturnType<typeof vi.fn>;
    let getSessionIdSpy: ReturnType<typeof vi.fn>;
    let handleRequestSpy: ReturnType<typeof vi.fn>;
    
    // Manual call tracking to work around vitest spy bug
    let createSessionCalls: any[] = [];
    let getSessionIdCalls: any[] = [];
    let handleRequestCalls: any[] = [];

    beforeEach(() => {
        // Create mock objects using vi.fn() directly
        mockACPClient = {
            initialize: vi.fn().mockResolvedValue(undefined),
            newSession: vi.fn().mockResolvedValue('session-123'),
            loadSession: vi.fn().mockResolvedValue(undefined),
            prompt: vi.fn().mockResolvedValue(undefined),
            cancelSession: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn(),
        };

        // Reset manual call tracking
        createSessionCalls = [];
        getSessionIdCalls = [];
        handleRequestCalls = [];
        
        // Create spies with manual call tracking (workaround for vitest spy bug)
        handleRequestSpy = vi.fn(async (...args: any[]) => {
            handleRequestCalls.push(args);
            return { metadata: { command: undefined } };
        });

        mockRequestHandler = {
            handleRequest: handleRequestSpy,
        };

        createSessionSpy = vi.fn(async (conversationId: string) => {
            createSessionCalls.push([conversationId]);
            return 'session-123';
        });
        getSessionIdSpy = vi.fn((conversationId: string) => {
            getSessionIdCalls.push([conversationId]);
            return null;
        });

        mockSessionManager = {
            createSession: createSessionSpy,
            loadSession: vi.fn().mockResolvedValue(undefined),
            getSessionId: getSessionIdSpy,
            getConversationId: vi.fn().mockReturnValue('conv-123'),
            cancelSession: vi.fn().mockResolvedValue(undefined),
            clearSession: vi.fn(),
            getAllSessions: vi.fn().mockReturnValue([]),
            initialize: vi.fn().mockResolvedValue(undefined),
        };

        mockAgentConfig = {
            getActiveProfile: vi.fn().mockReturnValue({
                name: 'default',
                executable: 'test-agent',
                args: [],
                env: {},
            }),
        };

        mockParticipant = {
            iconPath: undefined,
            dispose: vi.fn(),
        };

        vi.mocked(vscode.chat.createChatParticipant).mockReturnValue(mockParticipant);

        chatParticipant = new ACPChatParticipant(
            mockACPClient,
            mockRequestHandler,
            mockSessionManager,
            mockAgentConfig
        );
    });

    describe('constructor', () => {
        it('should create a chat participant', () => {
            expect(vscode.chat.createChatParticipant).toHaveBeenCalledWith(
                'copilot-chat.acp',
                expect.any(Function)
            );
        });

        it('should initialize the ACP client', () => {
            expect(mockACPClient.initialize).toHaveBeenCalled();
        });

        it('should initialize the session manager', () => {
            expect(mockSessionManager.initialize).toHaveBeenCalled();
        });
    });

    describe('handleRequest', () => {
        let mockRequest: Partial<vscode.ChatRequest>;
        let mockContext: Partial<vscode.ChatContext>;
        let mockStream: Partial<vscode.ChatResponseStream>;
        let mockToken: vscode.CancellationToken;

        beforeEach(() => {
            mockRequest = {
                prompt: 'Hello, agent!',
                command: undefined,
                references: [],
            };

            mockContext = {
                history: [],
                conversationId: 'conv-123',
            } as any;

            mockStream = {
                markdown: vi.fn(),
                progress: vi.fn(),
            };

            mockToken = { isCancellationRequested: false } as vscode.CancellationToken;
        });

        it('should handle a simple prompt', async () => {
            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[0][1];
            
            const result = await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, mockToken);
            
            // Verify the result structure
            expect(result).toEqual({ metadata: { command: undefined } });
            
            // Check if the mocks were called using manual call tracking
            expect(createSessionCalls).toEqual([['conv-123']]);
            expect(handleRequestCalls).toEqual([[
                'Hello, agent!',
                [],
                mockStream,
                mockToken
            ]]);
        });

        it('should create a new session if none exists', async () => {
            // Reset manual call tracking
            createSessionCalls = [];
            getSessionIdCalls = [];
            handleRequestCalls = [];

            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[0][1];
            
            await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, mockToken);

            expect(createSessionCalls.length).toBeGreaterThan(0);
        });

        it('should load existing session if session ID exists', async () => {
            // Reset manual call tracking
            createSessionCalls = [];
            getSessionIdCalls = [];
            handleRequestCalls = [];
            
            // Create a new session manager with getSessionId returning an existing session
            const customSessionManager = {
                initialize: vi.fn(async () => {}),
                getSessionId: vi.fn((conversationId: string) => {
                    getSessionIdCalls.push([conversationId]);
                    return 'existing-session-123';
                }),
                createSession: vi.fn(async (conversationId: string) => {
                    createSessionCalls.push([conversationId]);
                    return 'session-123';
                }),
                cancelSession: vi.fn(),
                dispose: vi.fn()
            };
            
            // Track the current number of createChatParticipant calls
            const callCountBefore = vi.mocked(vscode.chat.createChatParticipant).mock.calls.length;
            
            // Create a new chat participant with the custom session manager
            const customChatParticipant = new ACPChatParticipant(
                mockACPClient,
                mockRequestHandler,
                customSessionManager as any,
                mockAgentConfig
            );
            
            // Get the handler from the most recent call
            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[callCountBefore][1];
            await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, mockToken);
            
            expect(getSessionIdCalls).toEqual([['conv-123']]);
            expect(createSessionCalls.length).toBe(0); // Should not create a new session
            expect(handleRequestCalls.length).toBe(1); // Should still handle the request
        });

        it('should map chat references to embedded resources', async () => {
            // Reset manual call tracking
            createSessionCalls = [];
            getSessionIdCalls = [];
            handleRequestCalls = [];
            
            const mockUri = {
                fsPath: '/test/file.txt',
                toString: () => 'file:///test/file.txt'
            };
            
            mockRequest.references = [
                {
                    id: 'file:///test/file.txt',
                    value: { uri: mockUri }
                } as vscode.ChatPromptReference
            ];

            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[0][1];
            await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, mockToken);

            // Verify handleRequest was called with the raw references
            // (ACPRequestHandler will convert them to embedded resources internally)
            expect(handleRequestCalls.length).toBe(1);
            expect(handleRequestCalls[0][0]).toBe('Hello, agent!');
            expect(handleRequestCalls[0][1]).toEqual([
                {
                    id: 'file:///test/file.txt',
                    value: { uri: mockUri }
                }
            ]);
        });

        it('should handle cancellation', async () => {
            // Reset manual call tracking
            createSessionCalls = [];
            getSessionIdCalls = [];
            handleRequestCalls = [];
            
            const cancelToken = { isCancellationRequested: true } as vscode.CancellationToken;

            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[0][1];
            
            const result = await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, cancelToken);

            expect(result).toEqual({ metadata: { command: undefined } });
            expect(handleRequestCalls.length).toBe(0); // Should not call handleRequest if cancelled
        });

        it('should handle errors gracefully', async () => {
            // Reset manual call tracking
            createSessionCalls = [];
            getSessionIdCalls = [];
            handleRequestCalls = [];
            
            // Create a custom request handler that throws an error
            const customRequestHandler = {
                handleRequest: vi.fn(async (prompt: string, references: any[], stream: any, token: any) => {
                    handleRequestCalls.push([prompt, references, stream, token]);
                    throw new Error('Test error');
                })
            };
            
            // Track the current number of createChatParticipant calls
            const callCountBefore = vi.mocked(vscode.chat.createChatParticipant).mock.calls.length;
            
            // Create a new chat participant with the custom request handler
            const customChatParticipant = new ACPChatParticipant(
                mockACPClient,
                customRequestHandler as any,
                mockSessionManager,
                mockAgentConfig
            );

            // Get the handler from the most recent call
            const handler = vi.mocked(vscode.chat.createChatParticipant).mock.calls[callCountBefore][1];
            await handler(mockRequest as vscode.ChatRequest, mockContext as vscode.ChatContext, mockStream as vscode.ChatResponseStream, mockToken);

            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Test error')
            );
        });
    });

    describe('dispose', () => {
        it('should dispose all resources', () => {
            chatParticipant.dispose();

            expect(mockACPClient.dispose).toHaveBeenCalled();
            expect(mockParticipant.dispose).toHaveBeenCalled();
        });
    });
});

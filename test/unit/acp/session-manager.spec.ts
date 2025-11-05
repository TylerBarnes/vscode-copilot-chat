import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { SessionManager } from '../../../src/platform/acp/session-manager';
import { ACPClient } from '../../../src/platform/acp/acp-client';
import type { SessionInfo } from '../../../src/platform/acp/types';
import * as fs from 'fs/promises';


vi.mock('vscode');
vi.mock('fs/promises');

describe('SessionManager', () => {
	let sessionManager: SessionManager;
	let mockClient: Partial<ACPClient>;
	let mockStorageUri: vscode.Uri;

	beforeEach(() => {
		mockClient = {
			newSession: vi.fn(),
			loadSession: vi.fn(),
			cancelSession: vi.fn(),
		};

		mockStorageUri = {
			fsPath: '/test/storage',
		} as vscode.Uri;

		vi.mocked(fs.mkdir).mockResolvedValue(undefined);
		vi.mocked(fs.writeFile).mockResolvedValue(undefined);
		vi.mocked(fs.readFile).mockResolvedValue('{}');
		vi.mocked(fs.readdir).mockResolvedValue([]);

		sessionManager = new SessionManager(mockClient as ACPClient, mockStorageUri);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('createSession', () => {
		it('should create a new ACP session', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			const result = await sessionManager.createSession('conv-123');

            expect(mockClient.newSession).toHaveBeenCalledWith({
                cwd: expect.any(String),
            });
			expect(result).toEqual(sessionInfo);
		});

		it('should map conversation ID to session ID', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');

			const mappedSessionId = sessionManager.getSessionId('conv-123');
			expect(mappedSessionId).toBe('session-123');
		});

		it('should persist session mapping', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('sessions.json'),
				expect.stringContaining('session-123'),
				'utf-8'
			);
		});

		it('should support custom session mode', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

            vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

            await sessionManager.createSession('conv-123');

            expect(mockClient.newSession).toHaveBeenCalled();
		});
	});

	describe('loadSession', () => {
		it('should load an existing ACP session', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.loadSession!).mockResolvedValue(sessionInfo);

			const result = await sessionManager.loadSession('conv-123', 'session-123');

            expect(mockClient.loadSession).toHaveBeenCalledWith({ sessionId: 'session-123' });
			expect(result).toEqual(sessionInfo);
		});

		it('should map conversation ID to loaded session ID', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.loadSession!).mockResolvedValue(sessionInfo);

			await sessionManager.loadSession('conv-123', 'session-123');

			const mappedSessionId = sessionManager.getSessionId('conv-123');
			expect(mappedSessionId).toBe('session-123');
		});

		it('should persist loaded session mapping', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.loadSession!).mockResolvedValue(sessionInfo);

			await sessionManager.loadSession('conv-123', 'session-123');

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('sessions.json'),
				expect.stringContaining('session-123'),
				'utf-8'
			);
		});
	});

	describe('getSessionId', () => {
		it('should return session ID for mapped conversation', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');

			expect(sessionManager.getSessionId('conv-123')).toBe('session-123');
		});

		it('should return undefined for unmapped conversation', () => {
			expect(sessionManager.getSessionId('unknown-conv')).toBeUndefined();
		});
	});

	describe('getConversationId', () => {
		it('should return conversation ID for mapped session', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');

			expect(sessionManager.getConversationId('session-123')).toBe('conv-123');
		});

		it('should return undefined for unmapped session', () => {
			expect(sessionManager.getConversationId('unknown-session')).toBeUndefined();
		});
	});

	describe('cancelSession', () => {
		it('should cancel an active session', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');
			await sessionManager.cancelSession('conv-123');

			expect(mockClient.cancelSession).toHaveBeenCalledWith('session-123');
		});

		it('should throw error if session not found', async () => {
			await expect(sessionManager.cancelSession('unknown-conv')).rejects.toThrow(
				'No session found for conversation: unknown-conv'
			);
		});
	});

	describe('getAllSessions', () => {
		it('should return all active sessions', async () => {
			const sessionInfo1: SessionInfo = {
				sessionId: 'session-1',
			};

			const sessionInfo2: SessionInfo = {
				sessionId: 'session-2',
			};

			vi.mocked(mockClient.newSession!)
				.mockResolvedValueOnce(sessionInfo1)
				.mockResolvedValueOnce(sessionInfo2);

			await sessionManager.createSession('conv-1');
			await sessionManager.createSession('conv-2');

			const sessions = sessionManager.getAllSessions();

			expect(sessions).toHaveLength(2);
			expect(sessions).toContainEqual({
				conversationId: 'conv-1',
				sessionId: 'session-1',
			});
			expect(sessions).toContainEqual({
				conversationId: 'conv-2',
				sessionId: 'session-2',
			});
		});

		it('should return empty array if no sessions', () => {
			const sessions = sessionManager.getAllSessions();
			expect(sessions).toEqual([]);
		});
	});

	describe('persistence', () => {
		it('should restore sessions from storage on initialization', async () => {
			const savedSessions = {
				'conv-1': 'session-1',
				'conv-2': 'session-2',
			};

			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(savedSessions));

			const newManager = new SessionManager(mockClient as ACPClient, mockStorageUri);
			await newManager.initialize();

			expect(newManager.getSessionId('conv-1')).toBe('session-1');
			expect(newManager.getSessionId('conv-2')).toBe('session-2');
		});

		it('should handle missing storage file gracefully', async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

			const newManager = new SessionManager(mockClient as ACPClient, mockStorageUri);
			await newManager.initialize();

			expect(newManager.getAllSessions()).toEqual([]);
		});

		it('should handle corrupted storage file gracefully', async () => {
			vi.mocked(fs.readFile).mockResolvedValue('invalid json');

			const newManager = new SessionManager(mockClient as ACPClient, mockStorageUri);
			await newManager.initialize();

			expect(newManager.getAllSessions()).toEqual([]);
		});
	});

	describe('clearSession', () => {
		it('should remove session mapping', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');
			expect(sessionManager.getSessionId('conv-123')).toBe('session-123');

			await sessionManager.clearSession('conv-123');
			expect(sessionManager.getSessionId('conv-123')).toBeUndefined();
		});

		it('should persist cleared session mapping', async () => {
			const sessionInfo: SessionInfo = {
				sessionId: 'session-123',
			};

			vi.mocked(mockClient.newSession!).mockResolvedValue(sessionInfo);

			await sessionManager.createSession('conv-123');
			await sessionManager.clearSession('conv-123');

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('sessions.json'),
				expect.not.stringContaining('session-123'),
				'utf-8'
			);
		});
	});
});

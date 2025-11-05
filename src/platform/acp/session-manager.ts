import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ACPClient } from './acp-client';
import type { SessionInfo, SessionMode } from './types';

/**
 * Session creation options
 */
export interface SessionOptions {
	mode?: SessionMode;
}

/**
 * Session mapping entry
 */
export interface SessionMapping {
	conversationId: string;
	sessionId: string;
}

/**
 * Manages ACP session lifecycle and persistence
 * Maps VS Code conversation IDs to ACP session IDs
 */
export class SessionManager {
	private conversationToSession = new Map<string, string>();
	private sessionToConversation = new Map<string, string>();
	private storageFile: string;

	constructor(
		private client: ACPClient,
		private storageUri: vscode.Uri
	) {
		this.storageFile = path.join(storageUri.fsPath, 'sessions.json');
	}

	/**
	 * Initialize the session manager by loading persisted sessions
	 */
	async initialize(): Promise<void> {
		try {
			// Ensure storage directory exists
			await fs.mkdir(this.storageUri.fsPath, { recursive: true });

			// Load persisted sessions
			const data = await fs.readFile(this.storageFile, 'utf-8');
			const sessions = JSON.parse(data) as Record<string, string>;

			// Restore mappings
			for (const [conversationId, sessionId] of Object.entries(sessions)) {
				this.conversationToSession.set(conversationId, sessionId);
				this.sessionToConversation.set(sessionId, conversationId);
			}
		} catch (error) {
			// Storage file doesn't exist or is corrupted - start fresh
			// This is expected on first run
		}
	}

	/**
	 * Create a new ACP session
	 */
    async createSession(
        conversationId: string,
        options: SessionOptions = {}
    ): Promise<SessionInfo> {
        const sessionInfo = await this.client.newSession({
            cwd: process.cwd(),
        });

		// Store mapping
		this.conversationToSession.set(conversationId, sessionInfo.sessionId);
		this.sessionToConversation.set(sessionInfo.sessionId, conversationId);

		// Persist mapping
		await this.persistSessions();

		return sessionInfo;
	}

	/**
	 * Load an existing ACP session
	 */
    async loadSession(conversationId: string, sessionId: string): Promise<SessionInfo> {
        await this.client.loadSession({ sessionId });

        // Store mapping
        this.conversationToSession.set(conversationId, sessionId);
        this.sessionToConversation.set(sessionId, conversationId);

        // Persist mapping
        await this.persistSessions();

        return { sessionId };
    }

	/**
	 * Get ACP session ID for a conversation
	 */
	getSessionId(conversationId: string): string | undefined {
		return this.conversationToSession.get(conversationId);
	}

	/**
	 * Get conversation ID for an ACP session
	 */
	getConversationId(sessionId: string): string | undefined {
		return this.sessionToConversation.get(sessionId);
	}

	/**
	 * Cancel an active session
	 */
	async cancelSession(conversationId: string): Promise<void> {
		const sessionId = this.conversationToSession.get(conversationId);
		if (!sessionId) {
			throw new Error(`No session found for conversation: ${conversationId}`);
		}

		await this.client.cancelSession(sessionId);
	}

	/**
	 * Clear a session mapping (without canceling the session)
	 */
	async clearSession(conversationId: string): Promise<void> {
		const sessionId = this.conversationToSession.get(conversationId);
		if (sessionId) {
			this.conversationToSession.delete(conversationId);
			this.sessionToConversation.delete(sessionId);
			await this.persistSessions();
		}
	}

    /**
     * Get all active session mappings
     */
    getAllSessions(): SessionMapping[] {
        const sessions: SessionMapping[] = [];
        for (const [conversationId, sessionId] of this.conversationToSession.entries()) {
            sessions.push({ conversationId, sessionId });
        }
        return sessions;
    }

    /**
     * Get session by ID (compatibility method)
     */
    getSession(sessionId: string): { sessionId: string; conversationId?: string } | undefined {
        const conversationId = this.sessionToConversation.get(sessionId);
        if (conversationId) {
            return { sessionId, conversationId };
        }
        return undefined;
    }

    /**
     * Event emitter for session changes (compatibility method)
     */
    onDidChangeSession(handler: (sessionId: string) => void): void {
        // This is a stub for compatibility
        // In a full implementation, this would emit events when sessions change
    }

    /**
     * Persist session mappings to storage
     */
    private async persistSessions(): Promise<void> {
        const sessions: Record<string, string> = {};
        for (const [conversationId, sessionId] of this.conversationToSession.entries()) {
            sessions[conversationId] = sessionId;
        }

        await fs.writeFile(this.storageFile, JSON.stringify(sessions, null, 2), 'utf-8');
    }
}

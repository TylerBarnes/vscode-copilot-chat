/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess } from 'child_process';
import { JsonRpcClient } from './json-rpc-client';
import type {
    InitializeParams,
    InitializeResult,
    SessionNewParams,
    SessionNewResult,
    SessionLoadParams,
    SessionLoadResult,
    SessionSetModeParams,
    SessionSetModeResult,
    SessionPromptParams,
    SessionPromptResult,
    SessionCancelParams,
    SessionUpdateNotification,
    SessionRequestPermissionParams,
    SessionRequestPermissionResult,
    FsReadTextFileParams,
    FsReadTextFileResult,
    FsWriteTextFileParams,
    FsWriteTextFileResult,
    TerminalCreateParams,
    TerminalCreateResult,
    TerminalOutputParams,
    TerminalOutputResult,
    TerminalWaitForExitParams,
    TerminalWaitForExitResult,
    TerminalKillParams,
    TerminalKillResult,
    TerminalReleaseParams,
    TerminalReleaseResult,
    AgentCapabilities
} from './types';

/**
 * High-level ACP Client that manages communication with an ACP Agent.
 * 
 * This client handles:
 * - Agent initialization and capability negotiation
 * - Session management (create, load, set mode)
 * - Prompt execution with streaming updates
 * - Client-implemented methods (file system, terminal, permissions)
 * - Session cancellation
 * - Process lifecycle management
 */
export class ACPClient {
    private rpcClient: JsonRpcClient;
    private agentCapabilities: AgentCapabilities = {};
    private isInitialized = false;
    private isDisposed = false;
    private currentSessionId?: string;

    // Event handlers
    private sessionUpdateHandlers: Set<(update: SessionUpdateNotification) => void> = new Set();
    private readTextFileHandlers: Set<(params: FsReadTextFileParams) => Promise<FsReadTextFileResult>> = new Set();
    private writeTextFileHandlers: Set<(params: FsWriteTextFileParams) => Promise<FsWriteTextFileResult>> = new Set();
    private requestPermissionHandlers: Set<(params: SessionRequestPermissionParams) => Promise<SessionRequestPermissionResult>> = new Set();
    private terminalCreateHandlers: Set<(params: TerminalCreateParams) => Promise<TerminalCreateResult>> = new Set();
    private terminalOutputHandlers: Set<(params: TerminalOutputParams) => Promise<TerminalOutputResult>> = new Set();
    private terminalWaitForExitHandlers: Set<(params: TerminalWaitForExitParams) => Promise<TerminalWaitForExitResult>> = new Set();
    private terminalKillHandlers: Set<(params: TerminalKillParams) => Promise<TerminalKillResult>> = new Set();
    private terminalReleaseHandlers: Set<(params: TerminalReleaseParams) => Promise<TerminalReleaseResult>> = new Set();
    private processExitHandlers: Set<(code: number | null) => void> = new Set();
    private stderrHandlers: Set<(data: string) => void> = new Set();

    constructor(private process: ChildProcess) {
        this.rpcClient = new JsonRpcClient(process.stdin!, process.stdout!);
        this.setupClientMethods();
        this.setupProcessHandlers();
    }

    /**
     * Initialize the agent and negotiate capabilities
     */
    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.ensureNotDisposed();
        
        if (this.isInitialized) {
            throw new Error('Client is already initialized');
        }

        const result = await this.rpcClient.sendRequest<InitializeResult>('initialize', params);
        // Handle both 'capabilities' and 'agentCapabilities' for backwards compatibility
        this.agentCapabilities = result.agentCapabilities || (result as any).capabilities || {};
        this.isInitialized = true;

        return result;
    }

    /**
     * Create a new session
     */
    async newSession(params: SessionNewParams): Promise<SessionNewResult> {
        this.ensureInitialized();
        
        const result = await this.rpcClient.sendRequest<SessionNewResult>('session/new', params);
        this.currentSessionId = result.sessionId;
        
        return result;
    }

    /**
     * Load an existing session (if agent supports it)
     */
    async loadSession(params: SessionLoadParams): Promise<SessionLoadResult> {
        this.ensureInitialized();
        
        if (!this.agentCapabilities.loadSession) {
            throw new Error('Agent does not support loading sessions');
        }

        const result = await this.rpcClient.sendRequest<SessionLoadResult>('session/load', params);
        this.currentSessionId = params.sessionId;
        
        return result;
    }

    /**
     * Set the session mode (if agent supports it)
     */
    async setMode(params: SessionSetModeParams): Promise<SessionSetModeResult> {
        this.ensureInitialized();
        
        if (!this.agentCapabilities.setMode) {
            throw new Error('Agent does not support setting modes');
        }

        return this.rpcClient.sendRequest<SessionSetModeResult>('session/set_mode', params);
    }

    /**
     * Send a prompt to the agent
     */
    async prompt(params: SessionPromptParams): Promise<SessionPromptResult> {
        this.ensureInitialized();
        
        return this.rpcClient.sendRequest<SessionPromptResult>('session/prompt', params);
    }

    /**
     * Cancel an ongoing session operation
     */
    async cancelSession(sessionId: string): Promise<void> {
        this.ensureInitialized();
        
        const params: SessionCancelParams = { sessionId };
        this.rpcClient.sendNotification('session/cancel', params);
    }

    /**
     * Register a handler for session updates (streaming responses, tool calls, etc.)
     */
    onSessionUpdate(handler: (update: SessionUpdateNotification) => void): void {
        this.sessionUpdateHandlers.add(handler);
    }

    /**
     * Unregister a session update handler
     */
    offSessionUpdate(handler: (update: SessionUpdateNotification) => void): void {
        this.sessionUpdateHandlers.delete(handler);
    }

    /**
     * Register a handler for file read requests from the agent
     */
    onReadTextFile(handler: (params: FsReadTextFileParams) => Promise<FsReadTextFileResult>): void {
        this.readTextFileHandlers.add(handler);
    }

    /**
     * Register a handler for file write requests from the agent
     */
    onWriteTextFile(handler: (params: FsWriteTextFileParams) => Promise<FsWriteTextFileResult>): void {
        this.writeTextFileHandlers.add(handler);
    }

    /**
     * Register a handler for permission requests from the agent
     */
    onRequestPermission(handler: (params: SessionRequestPermissionParams) => Promise<SessionRequestPermissionResult>): void {
        this.requestPermissionHandlers.add(handler);
    }

    /**
     * Register a handler for terminal creation requests
     */
    onTerminalCreate(handler: (params: TerminalCreateParams) => Promise<TerminalCreateResult>): void {
        this.terminalCreateHandlers.add(handler);
    }

    /**
     * Register a handler for terminal output requests
     */
    onTerminalOutput(handler: (params: TerminalOutputParams) => Promise<TerminalOutputResult>): void {
        this.terminalOutputHandlers.add(handler);
    }

    /**
     * Register a handler for terminal wait for exit requests
     */
    onTerminalWaitForExit(handler: (params: TerminalWaitForExitParams) => Promise<TerminalWaitForExitResult>): void {
        this.terminalWaitForExitHandlers.add(handler);
    }

    /**
     * Register a handler for terminal kill requests
     */
    onTerminalKill(handler: (params: TerminalKillParams) => Promise<TerminalKillResult>): void {
        this.terminalKillHandlers.add(handler);
    }

    /**
     * Register a handler for terminal release requests
     */
    onTerminalRelease(handler: (params: TerminalReleaseParams) => Promise<TerminalReleaseResult>): void {
        this.terminalReleaseHandlers.add(handler);
    }

    /**
     * Register a handler for process exit events
     */
    onProcessExit(handler: (code: number | null) => void): void {
        this.processExitHandlers.add(handler);
    }

    /**
     * Register a handler for stderr output
     */
    onStderr(handler: (data: string) => void): void {
        this.stderrHandlers.add(handler);
    }

    /**
     * Get the current agent capabilities
     */
    getAgentCapabilities(): AgentCapabilities {
        return { ...this.agentCapabilities };
    }

    /**
     * Get the current session ID
     */
    getCurrentSessionId(): string | undefined {
        return this.currentSessionId;
    }

    /**
     * Check if the client is initialized
     */
    isReady(): boolean {
        return this.isInitialized && !this.isDisposed;
    }

    /**
     * Dispose of the client and clean up resources
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        this.isDisposed = true;
        this.rpcClient.dispose();
        
        // Kill the process if it's still running
        if (this.process && !this.process.killed) {
            this.process.kill();
        }

        // Clear all handlers
        this.sessionUpdateHandlers.clear();
        this.readTextFileHandlers.clear();
        this.writeTextFileHandlers.clear();
        this.requestPermissionHandlers.clear();
        this.terminalCreateHandlers.clear();
        this.terminalOutputHandlers.clear();
        this.terminalWaitForExitHandlers.clear();
        this.terminalKillHandlers.clear();
        this.terminalReleaseHandlers.clear();
        this.processExitHandlers.clear();
        this.stderrHandlers.clear();
    }

    /**
     * Setup client-implemented methods that the agent can call
     */
    private setupClientMethods(): void {
        // Session update notifications
        this.rpcClient.onNotification('session/update', (params: SessionUpdateNotification) => {
            this.sessionUpdateHandlers.forEach(handler => handler(params));
        });

        // File system methods
        this.rpcClient.onRequest('fs/read_text_file', async (params: FsReadTextFileParams) => {
            if (this.readTextFileHandlers.size === 0) {
                throw new Error('No handler registered for fs/read_text_file');
            }
            // Call the first handler (in practice, there should only be one)
            const handler = Array.from(this.readTextFileHandlers)[0];
            return handler(params);
        });

        this.rpcClient.onRequest('fs/write_text_file', async (params: FsWriteTextFileParams) => {
            if (this.writeTextFileHandlers.size === 0) {
                throw new Error('No handler registered for fs/write_text_file');
            }
            const handler = Array.from(this.writeTextFileHandlers)[0];
            return handler(params);
        });

        // Permission requests
        this.rpcClient.onRequest('session/request_permission', async (params: SessionRequestPermissionParams) => {
            if (this.requestPermissionHandlers.size === 0) {
                throw new Error('No handler registered for session/request_permission');
            }
            const handler = Array.from(this.requestPermissionHandlers)[0];
            return handler(params);
        });

        // Terminal methods
        this.rpcClient.onRequest('terminal/create', async (params: TerminalCreateParams) => {
            if (this.terminalCreateHandlers.size === 0) {
                throw new Error('No handler registered for terminal/create');
            }
            const handler = Array.from(this.terminalCreateHandlers)[0];
            return handler(params);
        });

        this.rpcClient.onRequest('terminal/output', async (params: TerminalOutputParams) => {
            if (this.terminalOutputHandlers.size === 0) {
                throw new Error('No handler registered for terminal/output');
            }
            const handler = Array.from(this.terminalOutputHandlers)[0];
            return handler(params);
        });

        this.rpcClient.onRequest('terminal/wait_for_exit', async (params: TerminalWaitForExitParams) => {
            if (this.terminalWaitForExitHandlers.size === 0) {
                throw new Error('No handler registered for terminal/wait_for_exit');
            }
            const handler = Array.from(this.terminalWaitForExitHandlers)[0];
            return handler(params);
        });

        this.rpcClient.onRequest('terminal/kill', async (params: TerminalKillParams) => {
            if (this.terminalKillHandlers.size === 0) {
                throw new Error('No handler registered for terminal/kill');
            }
            const handler = Array.from(this.terminalKillHandlers)[0];
            return handler(params);
        });

        this.rpcClient.onRequest('terminal/release', async (params: TerminalReleaseParams) => {
            if (this.terminalReleaseHandlers.size === 0) {
                throw new Error('No handler registered for terminal/release');
            }
            const handler = Array.from(this.terminalReleaseHandlers)[0];
            return handler(params);
        });
    }

    /**
     * Setup process event handlers
     */
    private setupProcessHandlers(): void {
        this.process.on('exit', (code) => {
            this.processExitHandlers.forEach(handler => handler(code));
        });

        if (this.process.stderr) {
            this.process.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                this.stderrHandlers.forEach(handler => handler(text));
            });
        }
    }

    /**
     * Ensure the client is initialized
     */
    private ensureInitialized(): void {
        this.ensureNotDisposed();
        
        if (!this.isInitialized) {
            throw new Error('Client is not initialized. Call initialize() first.');
        }
    }

    /**
     * Ensure the client is not disposed
     */
    private ensureNotDisposed(): void {
        if (this.isDisposed) {
            throw new Error('Client has been disposed');
        }
    }
}

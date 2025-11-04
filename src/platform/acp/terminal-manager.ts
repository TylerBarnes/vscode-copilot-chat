import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
    TerminalCreateParams,
    TerminalCreateResult,
    TerminalWaitForExitParams,
    TerminalWaitForExitResult,
    TerminalKillParams,
    TerminalReleaseParams
} from './types';

interface Terminal {
    id: string;
    process: ChildProcess;
    output: string;
    exitCode: number | null;
    exitPromise: Promise<number>;
    exitResolve?: (code: number) => void;
}

type OutputCallback = (terminalId: string, data: string) => void;

/**
 * Manages terminal processes for ACP agents.
 * Handles creation, execution, output capture, and lifecycle management.
 */
export class TerminalManager {
    private terminals: Map<string, Terminal> = new Map();
    private outputCallbacks: Set<OutputCallback> = new Set();
    private cwd: string;

    constructor(cwd: string) {
        this.cwd = cwd;
    }

    /**
     * Creates a new terminal and starts executing the command.
     * @param params Terminal creation parameters
     * @returns Terminal ID
     */
    async createTerminal(params: TerminalCreateParams): Promise<TerminalCreateResult> {
        const terminalId = randomUUID();

        // Merge environment variables
        const env = {
            ...process.env,
            ...params.env
        };

        // Spawn the process
        const childProcess = spawn(params.command, params.args || [], {
            cwd: this.cwd,
            env,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Create exit promise
        let exitResolve: ((code: number) => void) | undefined;
        const exitPromise = new Promise<number>((resolve) => {
            exitResolve = resolve;
        });

        const terminal: Terminal = {
            id: terminalId,
            process: childProcess,
            output: '',
            exitCode: null,
            exitPromise,
            exitResolve
        };

        this.terminals.set(terminalId, terminal);

        // Capture stdout
        childProcess.stdout?.on('data', (data: Buffer) => {
            const text = data.toString('utf-8');
            terminal.output += text;
            this.emitOutput(terminalId, text);
        });

        // Capture stderr
        childProcess.stderr?.on('data', (data: Buffer) => {
            const text = data.toString('utf-8');
            terminal.output += text;
            this.emitOutput(terminalId, text);
        });

        // Handle process exit
        childProcess.on('exit', (code, signal) => {
            const exitCode = code ?? (signal ? 1 : 0);
            terminal.exitCode = exitCode;
            if (terminal.exitResolve) {
                terminal.exitResolve(exitCode);
            }
        });

        // Handle process errors (e.g., command not found)
        childProcess.on('error', (error) => {
            const errorText = `Error: ${error.message}\n`;
            terminal.output += errorText;
            this.emitOutput(terminalId, errorText);
            
            // Ensure exit promise resolves
            if (terminal.exitCode === null) {
                terminal.exitCode = 1;
                if (terminal.exitResolve) {
                    terminal.exitResolve(1);
                }
            }
        });

        return { terminalId };
    }

    /**
     * Gets the accumulated output for a terminal.
     * @param terminalId Terminal ID
     * @returns Accumulated output string
     */
    getOutput(terminalId: string): string {
        const terminal = this.terminals.get(terminalId);
        return terminal?.output ?? '';
    }

    /**
     * Waits for a terminal to exit and returns the exit code.
     * @param params Parameters containing terminal ID
     * @returns Exit code
     */
    async waitForExit(params: TerminalWaitForExitParams): Promise<TerminalWaitForExitResult> {
        const terminal = this.terminals.get(params.terminalId);
        if (!terminal) {
            throw new Error('Terminal not found');
        }

        // If already exited, return immediately
        if (terminal.exitCode !== null) {
            return { exitCode: terminal.exitCode };
        }

        // Wait for exit
        const exitCode = await terminal.exitPromise;
        return { exitCode };
    }

    /**
     * Kills a running terminal.
     * @param params Parameters containing terminal ID
     */
    async killTerminal(params: TerminalKillParams): Promise<void> {
        const terminal = this.terminals.get(params.terminalId);
        if (!terminal) {
            throw new Error('Terminal not found');
        }

        // If already exited, nothing to do
        if (terminal.exitCode !== null) {
            return;
        }

        // Kill the process
        terminal.process.kill('SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 100));

        // Force kill if still running
        if (terminal.exitCode === null) {
            terminal.process.kill('SIGKILL');
        }
    }

    /**
     * Releases terminal resources.
     * Kills the terminal if still running and removes it from tracking.
     * @param params Parameters containing terminal ID
     */
    async releaseTerminal(params: TerminalReleaseParams): Promise<void> {
        const terminal = this.terminals.get(params.terminalId);
        if (!terminal) {
            throw new Error('Terminal not found');
        }

        // Kill if still running
        if (terminal.exitCode === null) {
            await this.killTerminal(params);
        }

        // Remove from tracking
        this.terminals.delete(params.terminalId);
    }

    /**
     * Registers a callback to be called when terminal output is received.
     * @param callback Function to call with terminal ID and output data
     */
    onOutput(callback: OutputCallback): void {
        this.outputCallbacks.add(callback);
    }

    /**
     * Unregisters an output callback.
     * @param callback Callback to remove
     */
    offOutput(callback: OutputCallback): void {
        this.outputCallbacks.delete(callback);
    }

    /**
     * Emits output to all registered callbacks.
     * @param terminalId Terminal ID
     * @param data Output data
     */
    private emitOutput(terminalId: string, data: string): void {
        for (const callback of this.outputCallbacks) {
            try {
                callback(terminalId, data);
            } catch (error) {
                // Ignore callback errors
            }
        }
    }

    /**
     * Disposes all terminals and cleans up resources.
     */
    dispose(): void {
        for (const terminal of this.terminals.values()) {
            try {
                if (terminal.exitCode === null) {
                    terminal.process.kill('SIGKILL');
                }
            } catch (error) {
                // Ignore errors during cleanup
            }
        }
        this.terminals.clear();
        this.outputCallbacks.clear();
    }
}

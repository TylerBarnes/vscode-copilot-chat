import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalManager } from '../../../src/platform/acp/terminal-manager';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

describe('TerminalManager', () => {
    let terminalManager: TerminalManager;
    let testDir: string;

    beforeEach(async () => {
        // Create a unique test directory
        testDir = path.join(os.tmpdir(), `acp-terminal-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(testDir, { recursive: true });
        terminalManager = new TerminalManager(testDir);
    });

    afterEach(async () => {
        // Clean up all terminals
        terminalManager.dispose();
        
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('createTerminal', () => {
        it('should create a terminal and return a terminalId', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['hello']
            });

            expect(result.terminalId).toBeDefined();
            expect(typeof result.terminalId).toBe('string');
            expect(result.terminalId.length).toBeGreaterThan(0);
        });

        it('should execute the command in the correct working directory', async () => {
            const testFile = path.join(testDir, 'test.txt');
            await fs.writeFile(testFile, 'test content', 'utf-8');

            const result = await terminalManager.createTerminal({
                command: 'ls',
                args: []
            });

            // Wait a bit for command to execute
            await new Promise(resolve => setTimeout(resolve, 100));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output).toContain('test.txt');
        });

        it('should handle environment variables', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sh',
                args: ['-c', 'echo $TEST_VAR'],
                env: { TEST_VAR: 'test_value' }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output).toContain('test_value');
        });

        it('should handle multiple terminals concurrently', async () => {
            const terminal1 = await terminalManager.createTerminal({
                command: 'echo',
                args: ['terminal1']
            });

            const terminal2 = await terminalManager.createTerminal({
                command: 'echo',
                args: ['terminal2']
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const output1 = terminalManager.getOutput(terminal1.terminalId);
            const output2 = terminalManager.getOutput(terminal2.terminalId);

            expect(output1).toContain('terminal1');
            expect(output2).toContain('terminal2');
        });

        it('should handle command not found errors', async () => {
            const result = await terminalManager.createTerminal({
                command: 'nonexistent-command-xyz',
                args: []
            });

            // Wait for process to fail
            await new Promise(resolve => setTimeout(resolve, 100));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output.length).toBeGreaterThan(0); // Should have error output
        });
    });

    describe('getOutput', () => {
        it('should return accumulated output', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['line1']
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output).toContain('line1');
        });

        it('should return empty string for non-existent terminal', () => {
            const output = terminalManager.getOutput('non-existent-id');
            expect(output).toBe('');
        });

        it('should accumulate output from multiple writes', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sh',
                args: ['-c', 'echo line1 && echo line2 && echo line3']
            });

            await new Promise(resolve => setTimeout(resolve, 200));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output).toContain('line1');
            expect(output).toContain('line2');
            expect(output).toContain('line3');
        });

        it('should include stderr output', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sh',
                args: ['-c', 'echo stdout && echo stderr >&2']
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const output = terminalManager.getOutput(result.terminalId);
            expect(output).toContain('stdout');
            expect(output).toContain('stderr');
        });
    });

    describe('waitForExit', () => {
        it('should resolve with exit code 0 for successful commands', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['success']
            });

            const exitResult = await terminalManager.waitForExit({
                terminalId: result.terminalId
            });

            expect(exitResult.exitCode).toBe(0);
        });

        it('should resolve with non-zero exit code for failed commands', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sh',
                args: ['-c', 'exit 42']
            });

            const exitResult = await terminalManager.waitForExit({
                terminalId: result.terminalId
            });

            expect(exitResult.exitCode).toBe(42);
        });

        it('should reject for non-existent terminal', async () => {
            await expect(
                terminalManager.waitForExit({ terminalId: 'non-existent-id' })
            ).rejects.toThrow('Terminal not found');
        });

        it('should handle already exited terminals', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['test']
            });

            // Wait for first exit
            await terminalManager.waitForExit({ terminalId: result.terminalId });

            // Wait again - should return immediately with same exit code
            const exitResult = await terminalManager.waitForExit({
                terminalId: result.terminalId
            });

            expect(exitResult.exitCode).toBe(0);
        });
    });

    describe('killTerminal', () => {
        it('should kill a running terminal', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sleep',
                args: ['10']
            });

            await terminalManager.killTerminal({ terminalId: result.terminalId });

            // Terminal should exit (possibly with non-zero code due to signal)
            const exitResult = await terminalManager.waitForExit({
                terminalId: result.terminalId
            });

            expect(exitResult.exitCode).not.toBe(0);
        });

        it('should handle killing non-existent terminal', async () => {
            await expect(
                terminalManager.killTerminal({ terminalId: 'non-existent-id' })
            ).rejects.toThrow('Terminal not found');
        });

        it('should handle killing already exited terminal', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['test']
            });

            await terminalManager.waitForExit({ terminalId: result.terminalId });

            // Should not throw when killing already exited terminal
            await expect(
                terminalManager.killTerminal({ terminalId: result.terminalId })
            ).resolves.not.toThrow();
        });
    });

    describe('releaseTerminal', () => {
        it('should release terminal resources', async () => {
            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['test']
            });

            await terminalManager.waitForExit({ terminalId: result.terminalId });
            await terminalManager.releaseTerminal({ terminalId: result.terminalId });

            // After release, terminal should not be found
            expect(terminalManager.getOutput(result.terminalId)).toBe('');
        });

        it('should handle releasing non-existent terminal', async () => {
            await expect(
                terminalManager.releaseTerminal({ terminalId: 'non-existent-id' })
            ).rejects.toThrow('Terminal not found');
        });

        it('should kill terminal if still running before release', async () => {
            const result = await terminalManager.createTerminal({
                command: 'sleep',
                args: ['10']
            });

            // Release without waiting for exit
            await terminalManager.releaseTerminal({ terminalId: result.terminalId });

            // Terminal should be gone
            expect(terminalManager.getOutput(result.terminalId)).toBe('');
        });
    });

    describe('dispose', () => {
        it('should clean up all terminals', async () => {
            const terminal1 = await terminalManager.createTerminal({
                command: 'sleep',
                args: ['10']
            });

            const terminal2 = await terminalManager.createTerminal({
                command: 'sleep',
                args: ['10']
            });

            terminalManager.dispose();

            // All terminals should be gone
            expect(terminalManager.getOutput(terminal1.terminalId)).toBe('');
            expect(terminalManager.getOutput(terminal2.terminalId)).toBe('');
        });

        it('should be safe to call multiple times', () => {
            expect(() => {
                terminalManager.dispose();
                terminalManager.dispose();
            }).not.toThrow();
        });
    });

    describe('output events', () => {
        it('should emit output events as data arrives', async () => {
            const outputs: string[] = [];
            
            terminalManager.onOutput((terminalId, data) => {
                outputs.push(data);
            });

            await terminalManager.createTerminal({
                command: 'sh',
                args: ['-c', 'echo line1 && echo line2']
            });

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(outputs.length).toBeGreaterThan(0);
            expect(outputs.join('')).toContain('line1');
            expect(outputs.join('')).toContain('line2');
        });

        it('should include terminalId in output events', async () => {
            let capturedTerminalId: string | null = null;
            
            terminalManager.onOutput((terminalId, data) => {
                capturedTerminalId = terminalId;
            });

            const result = await terminalManager.createTerminal({
                command: 'echo',
                args: ['test']
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(capturedTerminalId).toBe(result.terminalId);
        });
    });
});

/**
 * ACP Integration Tests
 * 
 * These tests spawn a real mock ACP agent as a subprocess and verify
 * end-to-end communication via the ACPClient.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { ACPClient } from '../../../src/platform/acp/acp-client';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ACP Integration Tests', () => {
	let testDir: string;
	let agentProcess: ChildProcess;
	let client: ACPClient;

	beforeEach(() => {
		// Create unique test directory
		testDir = join(tmpdir(), `acp-integration-test-${randomUUID()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up client
		if (client) {
			await client.dispose();
		}

		// Clean up agent process
		if (agentProcess && !agentProcess.killed) {
			agentProcess.kill();
		}

		// Clean up test directory
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	it('should initialize the agent', async () => {
		// Spawn the mock agent
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		// Create client
		client = new ACPClient(agentProcess);

		// Initialize
		const result = await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
				terminal: {
					create: true,
					output: true,
					waitForExit: true,
					kill: true,
					release: true,
				},
			},
			clientInfo: {
				name: 'VS Code Copilot Chat',
				version: '0.33.0',
			},
		});

		expect(result.protocolVersion).toBe('2025-01-13');
		expect(result.agentCapabilities).toBeDefined();
		expect(result.agentCapabilities.loadSession).toBe(true);
		expect(result.agentInfo).toBeDefined();
		expect(result.agentInfo.name).toBe('Mock ACP Agent');
	});

	it('should create a new session', async () => {
		// Spawn and initialize
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);
		await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {},
			clientInfo: { name: 'Test', version: '1.0.0' },
		});

		// Create session
		const result = await client.newSession({
			cwd: testDir,
			mcpServers: [],
		});

		expect(result.sessionId).toBeDefined();
		expect(result.sessionId).toMatch(/^session-\d+$/);
	});

	it('should send a prompt and receive streaming response', async () => {
		// Spawn and initialize
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);
		await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {},
			clientInfo: { name: 'Test', version: '1.0.0' },
		});

		// Create session
		const sessionResult = await client.newSession({
			cwd: testDir,
			mcpServers: [],
		});

		// Set up session update handler
		const chunks: string[] = [];
		client.onSessionUpdate((update) => {
			if (update.sessionUpdate === 'agent_message_chunk' && update.content) {
				for (const block of update.content) {
					if (block.type === 'text') {
						chunks.push(block.text);
					}
				}
			}
		});

		// Send prompt
		const promptResult = await client.prompt({
			sessionId: sessionResult.sessionId,
			prompt: [
				{
					type: 'text',
					text: 'Hello, agent!',
				},
			],
		});

		expect(promptResult.stopReason).toBe('end_turn');
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks.join('')).toContain('Mock response');
	});

	it('should load an existing session', async () => {
		// Spawn and initialize
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);
		const initResult = await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {},
			clientInfo: { name: 'Test', version: '1.0.0' },
		});

		// Verify agent supports loadSession
		expect(initResult.agentCapabilities.loadSession).toBe(true);

		// Create session and send a message
		const sessionResult = await client.newSession({
			cwd: testDir,
			mcpServers: [],
		});

		await client.prompt({
			sessionId: sessionResult.sessionId,
			prompt: [{ type: 'text', text: 'First message' }],
		});

		// Load the session
		const chunks: string[] = [];
		client.onSessionUpdate((update) => {
			if (update.sessionUpdate === 'agent_message_chunk' && update.content) {
				for (const block of update.content) {
					if (block.type === 'text') {
						chunks.push(block.text);
					}
				}
			}
		});

		await client.loadSession({
			sessionId: sessionResult.sessionId,
		});

		// Should receive the replayed message
		expect(chunks.length).toBeGreaterThan(0);
	});

	it('should handle session cancellation', async () => {
		// Spawn and initialize
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);
		await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {},
			clientInfo: { name: 'Test', version: '1.0.0' },
		});

		// Create session
		const sessionResult = await client.newSession({
			cwd: testDir,
			mcpServers: [],
		});

		// Cancel session (should not throw)
		await expect(client.cancelSession(sessionResult.sessionId)).resolves.toBeUndefined();
	});

	it('should handle invalid protocol version', async () => {
		// Spawn the mock agent
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);

		// Try to initialize with invalid version
		await expect(
			client.initialize({
				protocolVersion: '1999-01-01',
				capabilities: {},
				clientInfo: { name: 'Test', version: '1.0.0' },
			})
		).rejects.toThrow(/Unsupported protocol version/);
	});

	it('should handle invalid session ID', async () => {
		// Spawn and initialize
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);
		await client.initialize({
			protocolVersion: '2025-01-13',
			capabilities: {},
			clientInfo: { name: 'Test', version: '1.0.0' },
		});

		// Try to send prompt with invalid session ID
		await expect(
			client.prompt({
				sessionId: 'invalid-session-id',
				prompt: [{ type: 'text', text: 'Hello' }],
			})
		).rejects.toThrow(/Session not found/);
	});

	it('should handle agent process exit', async () => {
		// Spawn the mock agent
		const agentPath = join(__dirname, '../../mock-acp-agent/agent.ts');
		agentProcess = spawn('npx', ['tsx', agentPath], {
			cwd: testDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		client = new ACPClient(agentProcess);

		// Set up exit handler
		let exitCode: number | null = null;
		client.onProcessExit((code) => {
			exitCode = code;
		});

		// Kill the process
		agentProcess.kill();

		// Wait for exit event
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(exitCode).toBe(null); // SIGTERM results in null exit code
	});
});

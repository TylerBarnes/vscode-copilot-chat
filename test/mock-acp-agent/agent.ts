#!/usr/bin/env node

/**
 * Mock ACP Agent for Integration Testing
 * 
 * This is a minimal ACP agent that implements the protocol for testing purposes.
 * It communicates via stdin/stdout using newline-delimited JSON-RPC 2.0.
 */

import { Readable, Writable } from 'stream';

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: number | string;
	method: string;
	params?: any;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id: number | string;
	result?: any;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
}

interface JsonRpcNotification {
	jsonrpc: '2.0';
	method: string;
	params?: any;
}

class MockACPAgent {
    private buffer = '';
    private sessions = new Map<string, { cwd: string; messages: any[] }>();
    private nextSessionId = 1;
    private stdin: Readable;
    private stdout: Writable;

	constructor(stdin: Readable = process.stdin, stdout: Writable = process.stdout) {
		this.stdin = stdin;
		this.stdout = stdout;

		// Redirect console to stderr to keep stdout clean for JSON-RPC

		console.log = (...args: any[]) => process.stderr.write(`[LOG] ${args.join(' ')}
`);
		console.info = (...args: any[]) => process.stderr.write(`[INFO] ${args.join(' ')}
`);
		console.warn = (...args: any[]) => process.stderr.write(`[WARN] ${args.join(' ')}
`);

		this.setupStdinListener();
	}

	private setupStdinListener(): void {
		this.stdin.on('data', (chunk: Buffer) => {
			this.buffer += chunk.toString();
			const lines = this.buffer.split('\n');
			this.buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						const message = JSON.parse(line);
						this.handleMessage(message);
					} catch (error) {
						console.error('Failed to parse message:', line, error);
					}
				}
			}
		});

		this.stdin.on('end', () => {
			console.error('stdin closed');
			process.exit(0);
		});
	}

	private handleMessage(message: JsonRpcRequest | JsonRpcNotification): void {
		console.error('Received message:', JSON.stringify(message));

		// Handle notifications (no id)
		if (!('id' in message)) {
			this.handleNotification(message as JsonRpcNotification);
			return;
		}

		// Handle requests
		const request = message as JsonRpcRequest;
		try {
			const result = this.handleRequest(request);
			this.sendResponse({ jsonrpc: '2.0', id: request.id, result });
		} catch (error: any) {
			this.sendResponse({
				jsonrpc: '2.0',
				id: request.id,
				error: {
					code: error.code || -32603,
					message: error.message || 'Internal error',
					data: error.data,
				},
			});
		}
	}

	private handleRequest(request: JsonRpcRequest): any {
		switch (request.method) {
			case 'initialize':
				return this.handleInitialize(request.params);
			case 'session/new':
				return this.handleSessionNew(request.params);
			case 'session/load':
				return this.handleSessionLoad(request.params);
			case 'session/prompt':
				return this.handleSessionPrompt(request.params);
			case 'session/set_mode':
				return this.handleSetMode(request.params);
			default:
				throw { code: -32601, message: `Method not found: ${request.method}` };
		}
	}

	private handleNotification(notification: JsonRpcNotification): void {
		switch (notification.method) {
			case 'session/cancel':
				console.error('Session cancelled:', notification.params);
				break;
			default:
				console.error('Unknown notification:', notification.method);
		}
	}

	private handleInitialize(params: any): any {
		console.error('Initialize with params:', JSON.stringify(params));

		// Validate protocol version
		const clientVersion = params.protocolVersion;
		if (clientVersion !== '2025-01-13') {
			throw {
				code: -32602,
				message: `Unsupported protocol version: ${clientVersion}`,
			};
		}

        // Return agent capabilities
		return {
			protocolVersion: '2025-01-13',
			agentCapabilities: {
				loadSession: true,
				promptCapabilities: {
					embeddedContext: true,
					image: false,
					audio: false,
				},
				terminalCapabilities: {
					create: true,
					output: true,
					waitForExit: true,
					kill: true,
					release: true,
				},
				mcpCapabilities: {
					http: false,
					sse: false,
				},
			},
			agentInfo: {
				name: 'Mock ACP Agent',
				version: '1.0.0',
			},
		};
	}

	private handleSessionNew(params: any): any {
		const sessionId = `session-${this.nextSessionId++}`;
		this.sessions.set(sessionId, {
			cwd: params.cwd,
			messages: [],
		});

		console.error(`Created session ${sessionId} with cwd: ${params.cwd}`);

		return { sessionId };
	}

	private handleSessionLoad(params: any): any {
		const session = this.sessions.get(params.sessionId);
		if (!session) {
			throw {
				code: -32602,
				message: `Session not found: ${params.sessionId}`,
			};
		}

		console.error(`Loaded session ${params.sessionId}`);

		// Send session/update notifications to replay the conversation
		for (const message of session.messages) {
			this.sendNotification({
				jsonrpc: '2.0',
				method: 'session/update',
				params: {
					sessionId: params.sessionId,
					sessionUpdate: 'agent_message_chunk',
					content: message.content,
				},
			});
		}

		return {};
	}

	private handleSessionPrompt(params: any): any {
		const session = this.sessions.get(params.sessionId);
		if (!session) {
			throw {
				code: -32602,
				message: `Session not found: ${params.sessionId}`,
			};
		}

		console.error(`Prompt for session ${params.sessionId}:`, JSON.stringify(params.prompt));

		// Store the user message
		session.messages.push({
			role: 'user',
			content: params.prompt,
		});

		// Simulate agent response
		const responseText = `Mock response to: ${JSON.stringify(params.prompt)}`;

		// Send streaming response chunks
		const words = responseText.split(' ');
		for (const word of words) {
			this.sendNotification({
				jsonrpc: '2.0',
				method: 'session/update',
				params: {
					sessionId: params.sessionId,
					sessionUpdate: 'agent_message_chunk',
					content: [{ type: 'text', text: word + ' ' }],
				},
			});
		}

		// Store the agent message
		session.messages.push({
			role: 'agent',
			content: responseText,
		});

		// Send stop reason
		return {
			stopReason: 'end_turn',
		};
	}

	private handleSetMode(params: any): any {
		console.error(`Set mode for session ${params.sessionId} to ${params.mode}`);
		return {};
	}

	private sendResponse(response: JsonRpcResponse): void {
		const message = JSON.stringify(response) + '\n';
		console.error('Sending response:', message.trim());
		this.stdout.write(message);
	}

	private sendNotification(notification: JsonRpcNotification): void {
		const message = JSON.stringify(notification) + '\n';
		console.error('Sending notification:', message.trim());
		this.stdout.write(message);
	}

	start(): void {
		console.error('Mock ACP Agent started');
	}
}

// Start the agent if run directly
if (require.main === module) {
	const agent = new MockACPAgent();
	agent.start();
}

export { MockACPAgent };

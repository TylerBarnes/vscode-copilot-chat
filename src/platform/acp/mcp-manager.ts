import { spawn, ChildProcess } from 'child_process';

export interface MCPServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    transport: 'stdio' | 'http' | 'sse';
    url?: string; // For http/sse transports
    enabled?: boolean; // Whether the server is enabled
}

interface MCPServer {
	config: MCPServerConfig;
	process: ChildProcess;
	buffer: string;
	messageCallbacks: Set<(message: any) => void>;
	exitPromise: Promise<number>;
	exitResolve?: (code: number) => void;
}

export class MCPManager {
	private servers = new Map<string, MCPServer>();

	async startServer(config: MCPServerConfig): Promise<void> {
		if (this.servers.has(config.name)) {
			throw new Error(`MCP server "${config.name}" is already running`);
		}

		// Only stdio transport is supported for now
		if (config.transport !== 'stdio') {
			throw new Error(`Transport "${config.transport}" is not yet supported`);
		}

		const env = {
			...process.env,
			...config.env
		};

		const childProcess = spawn(config.command, config.args || [], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env
		});

		let exitResolve: ((code: number) => void) | undefined;
		const exitPromise = new Promise<number>((res) => {
			exitResolve = res;
		});

		const server: MCPServer = {
			config,
			process: childProcess,
			buffer: '',
			messageCallbacks: new Set(),
			exitPromise,
			exitResolve
		};

		// Handle process errors
		childProcess.on('error', (error) => {
			this.servers.delete(config.name);
			// Don't throw here, just log the error
			console.error(`MCP server "${config.name}" error:`, error);
		});

		// Handle process exit
		childProcess.on('exit', (code) => {
			server.exitResolve?.(code || 0);
			this.servers.delete(config.name);
		});

		// Handle stdout data
		childProcess.stdout?.on('data', (data: Buffer) => {
			server.buffer += data.toString();
			
			// Process complete messages (newline-delimited JSON)
			const lines = server.buffer.split('\n');
			server.buffer = lines.pop() || ''; // Keep incomplete line in buffer

			for (const line of lines) {
				if (line.trim()) {
					try {
						const message = JSON.parse(line);
						for (const callback of server.messageCallbacks) {
							callback(message);
						}
					} catch (error) {
						// Ignore invalid JSON
						console.error('Invalid JSON from MCP server:', line);
					}
				}
			}
		});

		// Handle stderr data
		childProcess.stderr?.on('data', (data: Buffer) => {
			console.error(`MCP server "${config.name}" stderr:`, data.toString());
		});

		this.servers.set(config.name, server);
		
		// Server is considered "started" immediately after spawn
		return Promise.resolve();
	}

	async stopServer(name: string): Promise<void> {
		const server = this.servers.get(name);
		if (!server) {
			return; // Already stopped or never started
		}

		server.process.kill('SIGTERM');
		
		// Wait for process to exit
		await server.exitPromise;
	}

	async restartServer(name: string): Promise<void> {
		const server = this.servers.get(name);
		if (!server) {
			throw new Error(`MCP server "${name}" is not running`);
		}

		const config = server.config;
		await this.stopServer(name);
		await this.startServer(config);
	}

	getRunningServers(): string[] {
		return Array.from(this.servers.keys());
	}

	getServerConfig(name: string): MCPServerConfig | undefined {
		return this.servers.get(name)?.config;
	}

	async sendMessage(name: string, message: any): Promise<void> {
		const server = this.servers.get(name);
		if (!server) {
			throw new Error(`MCP server "${name}" is not running`);
		}

		const json = JSON.stringify(message) + '\n';
		server.process.stdin?.write(json);
	}

	onMessage(name: string, callback: (message: any) => void): void {
		const server = this.servers.get(name);
		if (server) {
			server.messageCallbacks.add(callback);
		}
	}

    offMessage(name: string, callback: (message: any) => void): void {
        const server = this.servers.get(name);
        if (server) {
            server.messageCallbacks.delete(callback);
        }
    }

    /**
     * Get available tools from an MCP server (compatibility method)
     */
    async getTools(serverName: string): Promise<any[]> {
        const server = this.servers.get(serverName);
        if (!server) {
            return [];
        }
        
        // This is a stub - in a full implementation, this would query the MCP server
        // for its available tools via the MCP protocol
        return [];
    }

    async dispose(): Promise<void> {
        const stopPromises = Array.from(this.servers.keys()).map(name => 
            this.stopServer(name)
        );
        await Promise.all(stopPromises);
    }
}

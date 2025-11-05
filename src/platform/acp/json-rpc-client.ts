import { Readable, Writable } from 'stream';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

interface RequestOptions {
  timeout?: number;
}

type NotificationHandler = (params: any) => void;
type RequestHandler = (params: any) => Promise<any>;

/**
 * JSON-RPC 2.0 client for communicating with ACP agents via stdio
 */
export class JsonRpcClient {
  private nextId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private requestHandlers = new Map<string, RequestHandler>();
  private buffer = '';
  private disposed = false;
  private dataListener: ((chunk: Buffer) => void) | null = null;

  constructor(
    private stdin: Writable,
    private stdout: Readable
  ) {
    this.setupStdoutListener();
  }

  private setupStdoutListener(): void {
    this.dataListener = (chunk: Buffer) => {
      if (this.disposed) return;
      
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      this.buffer = lines[lines.length - 1];
      
      // Process complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          this.processMessage(line);
        }
      }
    };

    this.stdout.on('data', this.dataListener);
  }

  private processMessage(line: string): void {
    try {
      const message = JSON.parse(line);
      
      if (!message.jsonrpc || message.jsonrpc !== '2.0') {
        return; // Not a JSON-RPC 2.0 message
      }

      // Handle responses to our requests
      if ('id' in message && message.id !== null && message.id !== undefined) {
        if ('result' in message || 'error' in message) {
          this.handleResponse(message as JsonRpcResponse);
        } else if ('method' in message) {
          // This is a request from the agent
          this.handleIncomingRequest(message as JsonRpcRequest);
        }
      } 
      // Handle notifications
      else if ('method' in message) {
        this.handleNotification(message as JsonRpcNotification);
      }
    } catch (error) {
      // Invalid JSON, ignore
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);
    
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const handlers = this.notificationHandlers.get(notification.method);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(notification.params);
        } catch (error) {
          console.error(`Error in notification handler for ${notification.method}:`, error);
        }
      });
    }
  }

  private async handleIncomingRequest(request: JsonRpcRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);
    
    if (!handler) {
      // Method not found
      this.sendResponse(request.id!, null, {
        code: -32601,
        message: `Method not found: ${request.method}`
      });
      return;
    }

    try {
      const result = await handler(request.params);
      this.sendResponse(request.id!, result);
    } catch (error) {
      this.sendResponse(request.id!, null, {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      });
    }
  }

  private sendResponse(id: number, result?: any, error?: any): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id
    };

    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }

    this.stdin.write(JSON.stringify(response) + '\n');
  }

  /**
   * Send a JSON-RPC request and wait for the response
   */
  public sendRequest(method: string, params?: any, options?: RequestOptions): Promise<any> {
    if (this.disposed) {
      return Promise.reject(new Error('Client disposed'));
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject };

      if (options?.timeout) {
        pending.timeout = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }, options.timeout) as unknown as NodeJS.Timeout;
      }

      this.pendingRequests.set(id, pending);
      this.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  public sendNotification(method: string, params?: any): void {
    if (this.disposed) return;

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Register a handler for incoming notifications
   */
  public onNotification(method: string, handler: NotificationHandler): void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set());
    }
    this.notificationHandlers.get(method)!.add(handler);
  }

  /**
   * Remove a notification handler
   */
  public offNotification(method: string, handler: NotificationHandler): void {
    const handlers = this.notificationHandlers.get(method);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.notificationHandlers.delete(method);
      }
    }
  }

  /**
   * Register a handler for incoming requests
   */
  public onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Remove a request handler
   */
  public offRequest(method: string): void {
    this.requestHandlers.delete(method);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.disposed) return;
    
    this.disposed = true;

    // Remove stdout listener
    if (this.dataListener) {
      this.stdout.removeListener('data', this.dataListener);
      this.dataListener = null;
    }

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Client disposed'));
    }
    this.pendingRequests.clear();

    // Clear all handlers
    this.notificationHandlers.clear();
    this.requestHandlers.clear();
  }
}
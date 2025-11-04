import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';

// This will be our implementation
import { JsonRpcClient } from '../../../src/platform/acp/json-rpc-client';

describe('JsonRpcClient', () => {
  let client: JsonRpcClient;
  let mockStdin: Writable;
  let mockStdout: Readable;
  let stdoutEmitter: EventEmitter;

  beforeEach(() => {
    // Create mock streams
    stdoutEmitter = new EventEmitter();
    mockStdout = new Readable({
      read() {}
    }) as any;
    Object.assign(mockStdout, stdoutEmitter);

    mockStdin = new Writable({
      write(chunk: any, encoding: any, callback: any) {
        if (typeof callback === 'function') {
          callback();
        }
        return true;
      }
    }) as any;

    client = new JsonRpcClient(mockStdin, mockStdout);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('sendRequest', () => {
    it('should send a properly formatted JSON-RPC request', async () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      const requestPromise = client.sendRequest('test/method', { foo: 'bar' });

      // Verify the request was sent
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const sentData = writeSpy.mock.calls[0][0];
      const sentRequest = JSON.parse(sentData.toString().trim());

      expect(sentRequest).toMatchObject({
        jsonrpc: '2.0',
        method: 'test/method',
        params: { foo: 'bar' }
      });
      expect(sentRequest.id).toBeDefined();
      expect(typeof sentRequest.id).toBe('number');

      // Simulate response
      const responseId = sentRequest.id;
      const response = {
        jsonrpc: '2.0',
        id: responseId,
        result: { success: true }
      };
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });

    it('should handle error responses', async () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      const requestPromise = client.sendRequest('test/error', {});

      const sentData = writeSpy.mock.calls[0][0];
      const sentRequest = JSON.parse(sentData.toString().trim());
      const responseId = sentRequest.id;

      // Simulate error response
      const errorResponse = {
        jsonrpc: '2.0',
        id: responseId,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(errorResponse) + '\n'));

      await expect(requestPromise).rejects.toThrow('Method not found');
    });

    it('should handle multiple concurrent requests', async () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      // Send multiple requests
      const request1 = client.sendRequest('method1', { n: 1 });
      const request2 = client.sendRequest('method2', { n: 2 });
      const request3 = client.sendRequest('method3', { n: 3 });

      // Get the request IDs
      const sentRequests = writeSpy.mock.calls.map(call => 
        JSON.parse(call[0].toString().trim())
      );

      // Send responses out of order
      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: sentRequests[1].id,
        result: { response: 2 }
      }) + '\n'));

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: sentRequests[0].id,
        result: { response: 1 }
      }) + '\n'));

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: sentRequests[2].id,
        result: { response: 3 }
      }) + '\n'));

      const results = await Promise.all([request1, request2, request3]);
      expect(results).toEqual([
        { response: 1 },
        { response: 2 },
        { response: 3 }
      ]);
    });

    it('should timeout after specified duration', async () => {
      const requestPromise = client.sendRequest('test/timeout', {}, { timeout: 100 });

      await expect(requestPromise).rejects.toThrow('Request timeout');
    });
  });

  describe('sendNotification', () => {
    it('should send a notification without expecting a response', () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      client.sendNotification('test/notify', { data: 'test' });

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const sentData = writeSpy.mock.calls[0][0];
      const sentNotification = JSON.parse(sentData.toString().trim());

      expect(sentNotification).toEqual({
        jsonrpc: '2.0',
        method: 'test/notify',
        params: { data: 'test' }
      });
      expect(sentNotification.id).toBeUndefined();
    });
  });

  describe('onNotification', () => {
    it('should handle incoming notifications', () => {
      const handler = vi.fn();
      client.onNotification('session/update', handler);

      const notification = {
        jsonrpc: '2.0',
        method: 'session/update',
        params: { update: { sessionUpdate: 'agent_message_chunk', content: { text: 'Hello' } } }
      };

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(notification) + '\n'));

      expect(handler).toHaveBeenCalledWith(notification.params);
    });

    it('should handle multiple notification handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.onNotification('session/update', handler1);
      client.onNotification('session/update', handler2);

      const notification = {
        jsonrpc: '2.0',
        method: 'session/update',
        params: { test: true }
      };

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(notification) + '\n'));

      expect(handler1).toHaveBeenCalledWith(notification.params);
      expect(handler2).toHaveBeenCalledWith(notification.params);
    });
  });

  describe('onRequest', () => {
    it('should handle incoming requests and send responses', async () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      client.onRequest('session/request_permission', async (params) => {
        return { outcome: { outcome: 'selected', optionId: 'allow-once' } };
      });

      const request = {
        jsonrpc: '2.0',
        id: 123,
        method: 'session/request_permission',
        params: { toolCall: { name: 'fs/write' } }
      };

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(request) + '\n'));

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const sentData = writeSpy.mock.calls[0][0];
      const sentResponse = JSON.parse(sentData.toString().trim());

      expect(sentResponse).toEqual({
        jsonrpc: '2.0',
        id: 123,
        result: { outcome: { outcome: 'selected', optionId: 'allow-once' } }
      });
    });

    it('should send error response if handler throws', async () => {
      const writeSpy = vi.spyOn(mockStdin, 'write');

      client.onRequest('session/request_permission', async () => {
        throw new Error('Permission denied');
      });

      const request = {
        jsonrpc: '2.0',
        id: 456,
        method: 'session/request_permission',
        params: {}
      };

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(request) + '\n'));

      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));

      const sentData = writeSpy.mock.calls[0][0];
      const sentResponse = JSON.parse(sentData.toString().trim());

      expect(sentResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 456,
        error: {
          code: -32603,
          message: 'Permission denied'
        }
      });
    });
  });

  describe('message parsing', () => {
    it('should handle multiple messages in a single chunk', () => {
      const handler = vi.fn();
      client.onNotification('test/notify', handler);

      const messages = [
        { jsonrpc: '2.0', method: 'test/notify', params: { n: 1 } },
        { jsonrpc: '2.0', method: 'test/notify', params: { n: 2 } },
        { jsonrpc: '2.0', method: 'test/notify', params: { n: 3 } }
      ];

      const chunk = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
      stdoutEmitter.emit('data', Buffer.from(chunk));

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, { n: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { n: 2 });
      expect(handler).toHaveBeenNthCalledWith(3, { n: 3 });
    });

    it('should handle partial messages across chunks', () => {
      const handler = vi.fn();
      client.onNotification('test/notify', handler);

      const message = { jsonrpc: '2.0', method: 'test/notify', params: { test: true } };
      const fullMessage = JSON.stringify(message);
      
      // Split message in the middle
      const part1 = fullMessage.slice(0, 20);
      const part2 = fullMessage.slice(20) + '\n';

      stdoutEmitter.emit('data', Buffer.from(part1));
      expect(handler).not.toHaveBeenCalled();

      stdoutEmitter.emit('data', Buffer.from(part2));
      expect(handler).toHaveBeenCalledWith({ test: true });
    });

    it('should ignore invalid JSON lines', () => {
      const handler = vi.fn();
      client.onNotification('test/notify', handler);

      const chunk = 'invalid json\n' +
        JSON.stringify({ jsonrpc: '2.0', method: 'test/notify', params: { valid: true } }) + '\n' +
        'another invalid line\n';

      stdoutEmitter.emit('data', Buffer.from(chunk));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ valid: true });
    });
  });

  describe('dispose', () => {
    it('should clean up resources and reject pending requests', async () => {
      const request1 = client.sendRequest('test/method1', {});
      const request2 = client.sendRequest('test/method2', {});

      client.dispose();

      await expect(request1).rejects.toThrow('Client disposed');
      await expect(request2).rejects.toThrow('Client disposed');
    });

    it('should remove all event listeners', () => {
      const handler = vi.fn();
      client.onNotification('test/notify', handler);

      client.dispose();

      const notification = {
        jsonrpc: '2.0',
        method: 'test/notify',
        params: { test: true }
      };

      stdoutEmitter.emit('data', Buffer.from(JSON.stringify(notification) + '\n'));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
# ACP Testing Patterns

## Summary

This document outlines the testing patterns learned from examining:
- **Zed** (`/Users/tylerbarnes/code/zed-industries/zed`) - WHAT to test (Rust implementation)
- **Reese3** (`/Users/tylerbarnes/code/TylerBarnes/reese3`) - HOW to test (TypeScript implementation)

---

## Testing Infrastructure (TypeScript/Vitest)

### Test Setup Pattern (from Reese3)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync } from 'fs';

// JSON-RPC Communication Helper
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

async function sendJsonRpcRequest(
  subprocess: ChildProcess,
  method: string,
  params?: any
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    let responseBuffer = '';
    const onData = (chunk: Buffer) => {
      responseBuffer += chunk.toString();
      const lines = responseBuffer.split('\n');
      
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const response: JsonRpcResponse = JSON.parse(line);
            if (response.id === id) {
              subprocess.stdout?.off('data', onData);
              resolve(response);
              return;
            }
          } catch (err) {
            // Not JSON, continue
          }
        }
      }
      responseBuffer = lines[lines.length - 1];
    };

    subprocess.stdout?.on('data', onData);
    subprocess.stdin?.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      subprocess.stdout?.off('data', onData);
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 10000);
  });
}

// Test Suite Structure
describe('ACP Integration Tests', () => {
  let subprocess: ChildProcess;
  let testDir: string;

  beforeEach(() => {
    // Create unique test directory
    testDir = `/tmp/acp-test-${randomUUID()}`;
    mkdirSync(testDir, { recursive: true });

    // Spawn agent subprocess
    subprocess = spawn('node', ['path/to/agent', '--acp'], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  afterEach(() => {
    // Cleanup
    subprocess?.kill();
    rmSync(testDir, { recursive: true, force: true });
  });

  // Tests go here...
});
```

---

## Core ACP Test Categories

### 1. Initialization Tests

**What to test:**
- Protocol version negotiation
- Client capabilities declaration
- Agent capabilities response
- Invalid protocol version handling

**Example:**
```typescript
it('should initialize with correct protocol version', async () => {
  const response = await sendJsonRpcRequest(subprocess, 'initialize', {
    protocolVersion: '2024-11-05',
    clientInfo: { name: 'test-client', version: '1.0.0' },
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: { create: true, output: true, waitForExit: true, kill: true, release: true },
    },
  });

  expect(response.result).toBeDefined();
  expect(response.result.protocolVersion).toBe('2024-11-05');
  expect(response.result.agentCapabilities).toBeDefined();
  expect(response.result.agentCapabilities.loadSession).toBe(true);
});
```

### 2. Session Management Tests

**What to test:**
- Creating new sessions (`session/new`)
- Loading existing sessions (`session/load`)
- Session ID validation
- Session persistence
- Multiple concurrent sessions

**Example:**
```typescript
it('should create a new session', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  
  const response = await sendJsonRpcRequest(subprocess, 'session/new', {
    cwd: testDir,
    mcpServers: [],
  });

  expect(response.result).toBeDefined();
  expect(response.result.sessionId).toBeDefined();
  expect(typeof response.result.sessionId).toBe('string');
});

it('should load an existing session', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const newSession = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });
  
  const loadResponse = await sendJsonRpcRequest(subprocess, 'session/load', {
    sessionId: newSession.result.sessionId,
    cwd: testDir,
  });

  expect(loadResponse.result).toBeDefined();
  expect(loadResponse.result.sessionId).toBe(newSession.result.sessionId);
});
```

### 3. Prompt Execution Tests

**What to test:**
- Basic message exchange
- Streaming responses (`agent_message_chunk`)
- Multiple content blocks (text, images, embedded resources)
- System prompts
- Stop reasons (end_turn, max_tokens, cancelled, refusal)
- Message caching
- Message truncation

**Example:**
```typescript
it('should execute a simple prompt', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const session = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });

  const chunks: string[] = [];
  const notificationListener = (chunk: Buffer) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const notification = JSON.parse(line);
          if (notification.method === 'session/update' && 
              notification.params?.update?.sessionUpdate === 'agent_message_chunk') {
            chunks.push(notification.params.update.content.text);
          }
        } catch {}
      }
    }
  };

  subprocess.stdout?.on('data', notificationListener);

  const response = await sendJsonRpcRequest(subprocess, 'session/prompt', {
    sessionId: session.result.sessionId,
    prompt: [{ type: 'text', text: 'Hello, agent!' }],
  });

  expect(response.result).toBeDefined();
  expect(response.result.stopReason).toBe('end_turn');
  expect(chunks.length).toBeGreaterThan(0);

  subprocess.stdout?.off('data', notificationListener);
});
```

### 4. Tool Call Tests

**What to test:**
- Basic tool invocation
- Tool call status lifecycle (pending → in_progress → completed/failed)
- Concurrent tool calls
- Tool hallucination (nonexistent tools)
- Tool truncation
- Streaming tool inputs
- Tool use limits and resumption

**Example:**
```typescript
it('should handle basic tool calls', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const session = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });

  const toolCalls: any[] = [];
  const notificationListener = (chunk: Buffer) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const notification = JSON.parse(line);
          if (notification.method === 'session/update') {
            const update = notification.params?.update;
            if (update?.sessionUpdate === 'tool_call' || 
                update?.sessionUpdate === 'tool_call_update') {
              toolCalls.push(update);
            }
          }
        } catch {}
      }
    }
  };

  subprocess.stdout?.on('data', notificationListener);

  await sendJsonRpcRequest(subprocess, 'session/prompt', {
    sessionId: session.result.sessionId,
    prompt: [{ type: 'text', text: 'Read the file test.txt' }],
  });

  // Wait for tool calls
  await new Promise(resolve => setTimeout(resolve, 2000));

  expect(toolCalls.length).toBeGreaterThan(0);
  expect(toolCalls[0].status).toBe('pending');
  
  subprocess.stdout?.off('data', notificationListener);
});
```

### 5. Permission Request Tests

**What to test:**
- User permission flow (`session/request_permission`)
- Permission options (allow_once, allow_always, reject_once, reject_always)
- Tool execution after approval
- Tool rejection handling
- Permission persistence (allow_always/reject_always)

**Example:**
```typescript
it('should request permission for tool execution', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const session = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });

  let permissionRequest: any = null;
  const requestListener = (chunk: Buffer) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          if (request.method === 'session/request_permission') {
            permissionRequest = request;
            // Auto-respond with allow_once
            subprocess.stdin?.write(JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                outcome: { outcome: 'selected', optionId: 'allow-once' }
              }
            }) + '\n');
          }
        } catch {}
      }
    }
  };

  subprocess.stdout?.on('data', requestListener);

  await sendJsonRpcRequest(subprocess, 'session/prompt', {
    sessionId: session.result.sessionId,
    prompt: [{ type: 'text', text: 'Create a file test.txt' }],
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  expect(permissionRequest).not.toBeNull();
  expect(permissionRequest.params.toolCall).toBeDefined();
  expect(permissionRequest.params.options).toContainEqual(
    expect.objectContaining({ kind: 'allow_once' })
  );

  subprocess.stdout?.off('data', requestListener);
});
```

### 6. File System Tests

**What to test:**
- Reading text files (`fs/read_text_file`)
- Writing text files (`fs/write_text_file`)
- Path validation (absolute paths, within cwd)
- File not found errors
- Permission errors

**Example:**
```typescript
it('should read text files', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  
  // Create a test file
  const testFile = `${testDir}/test.txt`;
  writeFileSync(testFile, 'Hello, world!');

  const response = await sendJsonRpcRequest(subprocess, 'fs/read_text_file', {
    path: testFile,
  });

  expect(response.result).toBeDefined();
  expect(response.result.content).toBe('Hello, world!');
});
```

### 7. Terminal Tests

**What to test:**
- Creating terminals (`terminal/create`)
- Reading output (`terminal/output`)
- Waiting for exit (`terminal/wait_for_exit`)
- Killing terminals (`terminal/kill`)
- Releasing terminals (`terminal/release`)
- Exit codes and signals
- Timeout handling

**Example:**
```typescript
it('should create and execute terminal commands', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });

  const createResponse = await sendJsonRpcRequest(subprocess, 'terminal/create', {
    command: 'echo',
    args: ['Hello, terminal!'],
    cwd: testDir,
  });

  expect(createResponse.result).toBeDefined();
  const terminalId = createResponse.result.terminalId;

  const exitResponse = await sendJsonRpcRequest(subprocess, 'terminal/wait_for_exit', {
    terminalId,
    timeoutMs: 5000,
  });

  expect(exitResponse.result).toBeDefined();
  expect(exitResponse.result.output).toContain('Hello, terminal!');
  expect(exitResponse.result.exitCode).toBe(0);
});
```

### 8. MCP Integration Tests

**What to test:**
- MCP server configuration
- MCP tool availability
- MCP tool invocation
- Tool name collision resolution
- MCP tool truncation

**Example:**
```typescript
it('should integrate with MCP servers', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  
  const session = await sendJsonRpcRequest(subprocess, 'session/new', {
    cwd: testDir,
    mcpServers: [
      {
        name: 'test-server',
        command: 'node',
        args: ['test-mcp-server.js'],
      }
    ],
  });

  // Test that MCP tools are available
  // (Implementation depends on how agent exposes available tools)
});
```

### 9. Cancellation Tests

**What to test:**
- Canceling ongoing operations (`session/cancel`)
- New send canceling previous
- Subsequent successful sends not canceling

**Example:**
```typescript
it('should cancel ongoing operations', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const session = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });

  // Start a long-running prompt
  const promptPromise = sendJsonRpcRequest(subprocess, 'session/prompt', {
    sessionId: session.result.sessionId,
    prompt: [{ type: 'text', text: 'Generate a very long response...' }],
  });

  // Cancel it immediately
  await new Promise(resolve => setTimeout(resolve, 100));
  await sendJsonRpcRequest(subprocess, 'session/cancel', {
    sessionId: session.result.sessionId,
  });

  const response = await promptPromise;
  expect(response.result.stopReason).toBe('cancelled');
});
```

### 10. Error Handling Tests

**What to test:**
- Invalid method calls (JSON-RPC error -32601)
- Missing required parameters
- Invalid session IDs
- File system errors
- Terminal errors
- Agent refusal and message rollback

**Example:**
```typescript
it('should handle invalid method calls', async () => {
  const response = await sendJsonRpcRequest(subprocess, 'invalid/method', {});

  expect(response.error).toBeDefined();
  expect(response.error?.code).toBe(-32601);
  expect(response.error?.message).toContain('Method not found');
});

it('should handle missing session ID', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });

  const response = await sendJsonRpcRequest(subprocess, 'session/prompt', {
    sessionId: 'nonexistent-session',
    prompt: [{ type: 'text', text: 'Hello' }],
  });

  expect(response.error).toBeDefined();
});
```

### 11. Agent-Specific Tests

**What to test:**
- Agent profiles and mode switching (`session/set_mode`)
- Slash commands
- Agent plan updates
- Title generation
- Thinking steps

**Example:**
```typescript
it('should support agent profiles', async () => {
  await sendJsonRpcRequest(subprocess, 'initialize', { /* ... */ });
  const session = await sendJsonRpcRequest(subprocess, 'session/new', { cwd: testDir });

  const response = await sendJsonRpcRequest(subprocess, 'session/set_mode', {
    sessionId: session.result.sessionId,
    modeId: 'architect',
  });

  expect(response.result).toBeDefined();
});
```

---

## Key Testing Principles

1. **Test via subprocess communication**: Spawn the agent as a subprocess and communicate via stdin/stdout using newline-delimited JSON-RPC.

2. **Use unique test directories**: Create a unique temporary directory for each test to avoid conflicts.

3. **Listen for notifications**: Set up stdout listeners to capture `session/update` notifications for streaming responses, tool calls, etc.

4. **Clean up resources**: Always kill subprocesses and remove test directories in `afterEach`.

5. **Test the full lifecycle**: For features like tool calls, test the entire status lifecycle (pending → in_progress → completed/failed).

6. **Test error cases**: Don't just test happy paths—test invalid inputs, missing parameters, and error conditions.

7. **Use timeouts**: Set reasonable timeouts for async operations to prevent tests from hanging.

8. **Verify JSON-RPC compliance**: Ensure all requests/responses follow the JSON-RPC 2.0 spec.

---

## Next Steps for VS Code Extension

For the VS Code extension ACP Client implementation, we'll adapt these patterns:

1. **Create `src/platform/acp/client.ts`**: JSON-RPC 2.0 client for communicating with ACP agents via stdio.

2. **Create `test/unit/acp/`**: Unit tests for ACP client components (JSON-RPC transport, message parsing, etc.).

3. **Create `test/integration/acp/`**: Integration tests that spawn a mock ACP agent and test the full communication flow.

4. **Mock ACP Agent**: Create a simple mock agent for testing that implements the ACP protocol.

5. **Test-Driven Development**: Write tests first, then implement the functionality to make them pass.

---

## References

- **Zed ACP Tests**: `/Users/tylerbarnes/code/zed-industries/zed/crates/agent/src/tests/mod.rs`
- **Reese3 ACP Tests**: `/Users/tylerbarnes/code/TylerBarnes/reese3/src/tests/acp-integration.test.ts`
- **Reese3 ACP Agent**: `/Users/tylerbarnes/code/TylerBarnes/reese3/src/acp/agent.ts`
- **ACP Specification**: https://agentclientprotocol.org/

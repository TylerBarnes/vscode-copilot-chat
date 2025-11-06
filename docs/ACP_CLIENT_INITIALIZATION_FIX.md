# ACP Client Initialization Fix

## Problem

The ACP client was being created but never initialized, leading to the error:
```
Failed to send message: Error: Client is not initialized. Call initialize() first.
```

Additionally, the agent process was returning:
```
Failed to initialize ACP client: Error: Invalid params
```

## Root Cause

In `src/platform/acp/acp.contribution.ts`, the `ACPClient` was being instantiated via `instantiationService.createInstance()` but the `initialize()` method was never called. The ACP protocol requires the client to send an `initialize` request with:
- `protocolVersion`: The ACP protocol version
- `clientCapabilities`: What capabilities the client supports (file system, terminal, etc.)
- `clientInfo`: Information about the client (name, version)

Without this initialization handshake, the agent cannot process any requests.

## Solution

Added explicit `ACPClient.initialize()` call after the client is created, with proper error handling:

```typescript
// Initialize ACP client
this.logService.info('[ACP] Initializing ACP client...');
try {
    await this.acpClient!.initialize({
        protocolVersion: '2024-11-05',
        clientCapabilities: {
            fs: {
                readTextFile: true,
                writeTextFile: true
            },
            terminal: {
                create: true,
                output: true,
                waitForExit: true,
                kill: true,
                release: true
            }
        },
        clientInfo: {
            name: 'vscode-copilot-chat-acp',
            version: '0.33.0'
        }
    });
    this.logService.info('[ACP] ACP client initialized successfully');
} catch (error) {
    this.logService.error('[ACP] Failed to initialize ACP client:', error);
    this.chatViewProvider.showMessage(`Failed to initialize ACP client: ${error}`, 'error');
    return;
}
```

## Key Changes

1. **Added `ACPClient.initialize()` call** in `src/platform/acp/acp.contribution.ts` (lines 196-218)
   - Sends proper initialization parameters to the agent
   - Includes comprehensive client capabilities
   - Logs initialization progress
   - Handles errors gracefully by showing message in chat UI

2. **Updated test mocks** in `test/unit/acp/acp-contribution.spec.ts`
   - Added `initialize: vi.fn().mockResolvedValue(undefined)` to `mockACPClient`
   - Added log message expectations for initialization steps

## Verification

### Tests
- ✅ All 448 ACP unit tests passing
- ✅ All 8 ACP integration tests passing
- ✅ TypeScript check passes with no errors

### Build
- ✅ Extension successfully built with `tsx .esbuild.ts`
- ✅ Extension successfully packaged: `copilot-chat-acp-0.33.0.vsix` (227.51 KB)
- ✅ Extension successfully installed

## Expected Behavior

After this fix:
1. The ACP client will properly initialize with the agent
2. The agent will acknowledge the initialization with its capabilities
3. The chat UI will be able to send and receive messages
4. File system and terminal operations will be available

## Next Steps

1. Reload VS Code to activate the new extension version
2. Open the "ACP Chat" output panel to verify initialization logs
3. Try sending a message in the ACP Chat view
4. Verify the agent responds correctly

The logs should show:
```
[ACP] Initializing ACP client...
[ACP] ACP client initialized successfully
```

If initialization fails, the error will be displayed in both the output panel and the chat UI.

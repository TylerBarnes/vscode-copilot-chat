# Client Capabilities Fix

## Problem
The ACP agent was rejecting the `initialize` call with `Error: Invalid params` during extension activation.

## Root Cause
The `clientCapabilities.terminal` property was being sent as an object with detailed capability flags:
```typescript
terminal: {
    create: true,
    output: true,
    waitForExit: true,
    kill: true,
    release: true
}
```

However, according to the official ACP protocol specification (https://agentclientprotocol.com/protocol/initialization), the `terminal` capability should be a simple boolean:
```typescript
terminal: boolean
```

## Solution
Updated the `ClientCapabilities` interface in `src/platform/acp/types.ts` to match the ACP spec:
```typescript
export interface ClientCapabilities {
    fs?: {
        readTextFile?: boolean;
        writeTextFile?: boolean;
    };
    terminal?: boolean;  // Changed from object to boolean
}
```

Updated the `initialize` call in `src/platform/acp/acp.contribution.ts`:
```typescript
await this.acpClient.initialize({
    protocolVersion: '2025-01-13',
    clientCapabilities: {
        fs: {
            readTextFile: true,
            writeTextFile: true
        },
        terminal: true  // Simplified from object to boolean
    },
    clientInfo: {
        name: 'vscode-copilot-chat-acp',
        version: '0.33.0'
    }
});
```

## Changes Made
1. **src/platform/acp/types.ts**: Updated `ClientCapabilities.terminal` from object to boolean
2. **src/platform/acp/acp.contribution.ts**: Updated `initialize` call to use `terminal: true`
3. **test/unit/acp/acp-client.spec.ts**: Updated test expectations
4. **test/integration/acp/acp-integration.spec.ts**: Updated integration test expectations

## Verification
- ✅ All 456 ACP tests passing (448 unit + 8 integration)
- ✅ TypeScript check passes with no errors
- ✅ Extension builds successfully (227.57 KB)
- ✅ Extension installed successfully

## Next Steps
1. Reload VS Code
2. Open the "ACP Chat" output panel (View > Output > ACP Chat)
3. Try sending a message in the ACP Chat view
4. Verify the agent initializes without the "Invalid params" error

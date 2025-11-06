# Protocol Version Fix

## Problem
The ACP agent was rejecting the `initialize` call with `Error: Invalid params`, preventing the extension from establishing a connection with the agent.

## Root Cause
Protocol version mismatch between the client and agent:
- Client was sending: `protocolVersion: '2024-11-05'`
- Mock agent expected: `protocolVersion: '2025-01-13'`

## Solution
Updated the ACP client initialization in `src/platform/acp/acp.contribution.ts` to use the correct protocol version:

```typescript
await this.acpClient!.initialize({
    protocolVersion: '2025-01-13',  // Changed from '2024-11-05'
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
```

## Key Changes
1. **Protocol Version**: Changed from `'2024-11-05'` to `'2025-01-13'`
2. **Tests**: Integration tests already used the correct version
3. **TypeScript**: No type changes needed
4. **Build**: Successfully built and packaged

## Verification
- ✅ All 448 unit tests passing
- ✅ All 8 integration tests passing
- ✅ TypeScript check passing with no errors
- ✅ Extension built and packaged (227.95 KB)
- ✅ Extension installed successfully

## Next Steps
1. Reload VS Code
2. Open the "ACP Chat" output panel
3. Try sending a message to verify the agent initializes successfully
4. Check for any remaining errors in the logs

## Expected Behavior
After this fix, the ACP agent should:
- Accept the `initialize` call without "Invalid params" error
- Return agent capabilities successfully
- Allow the extension to proceed with session creation and message handling
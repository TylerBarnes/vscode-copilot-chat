# Protocol Version Number Fix

## Problem
The ACP agent was rejecting the `initialize` call with:
```
Error: Invalid params
data: {
  protocolVersion: {
    _errors: [ "Expected number, received string" ]
  }
}
```

The extension was sending `protocolVersion: "2025-01-13"` (string), but the agent expected a numeric value.

## Root Cause
The ACP protocol specification defines `protocolVersion` as a **number**, not a string. The date-based version format `2025-01-13` should be converted to a numeric format like `20250113`.

## Solution
1. **Updated Type Definitions** (`src/platform/acp/types.ts`):
   - Changed `InitializeParams.protocolVersion` from `string` to `number`
   - Changed `InitializeResult.protocolVersion` from `string` to `number`

2. **Updated Client Code** (`src/platform/acp/acp.contribution.ts`):
   - Changed `protocolVersion: '2025-01-13'` to `protocolVersion: 20250113`

3. **Updated Tests**:
   - `test/unit/acp/acp-client.spec.ts`: Changed `'0.1.0'` to `10`
   - `test/integration/acp/acp-integration.spec.ts`: Changed `'2025-01-13'` to `20250113` and `'1999-01-01'` to `19990101`
   - `test/mock-acp-agent/agent.ts`: Updated to expect and return numeric protocol version

4. **Fixed Syntax Errors**:
   - Removed literal newline characters in string literals in `test/mock-acp-agent/agent.ts`

## Key Changes

### Type Definition
```typescript
export interface InitializeParams {
    protocolVersion: number;  // Changed from string
    clientCapabilities: ClientCapabilities;
    clientInfo: ClientInfo;
}
```

### Initialize Call
```typescript
await this.acpClient.initialize({
    protocolVersion: 20250113,  // Changed from '2025-01-13'
    clientCapabilities: {
        fs: {
            readTextFile: true,
            writeTextFile: true
        },
        terminal: true
    },
    clientInfo: {
        name: 'vscode-copilot-chat-acp',
        version: '0.33.0'
    }
});
```

## Verification
- ✅ All 456 ACP tests passing (448 unit + 8 integration)
- ✅ TypeScript check passes with zero errors
- ✅ Extension built successfully (227.57 KB)
- ✅ Extension installed successfully

## Next Steps
1. Reload VS Code
2. Open the "ACP Chat" output panel
3. Try sending a message in the ACP Chat view
4. Verify the agent initializes without the "Invalid params" error

The agent should now accept the numeric protocol version and complete the initialization handshake successfully! 🎉

# MCP Servers Parameter Fix

## Problem

The ACP agent was rejecting `session/new` requests with `Error: Invalid params`:

```
Error handling request {
  jsonrpc: "2.0",
  id: 2,
  method: "session/new",
  params: {
    cwd: "/",
  },
} {
  code: -32602,
  message: "Invalid params",
  data: {
    _errors: [],
    mcpServers: {
      _errors: [ "Required" ],
    },
  },
}
```

The agent expected the `mcpServers` field to be present in `SessionNewParams`, but the client was only sending `cwd`.

## Root Cause

In `src/platform/acp/session-manager.ts`, the `createSession` method was calling `client.newSession()` with only the `cwd` parameter:

```typescript
const sessionInfo = await this.client.newSession({
    cwd: process.cwd(),
});
```

According to the ACP protocol specification and the agent's validation schema, `mcpServers` is a required field in `SessionNewParams`, even if no MCP servers are configured.

## Solution

Updated `src/platform/acp/session-manager.ts` to include an empty `mcpServers` array when creating a new session:

```typescript
const sessionInfo = await this.client.newSession({
    cwd: process.cwd(),
    mcpServers: [], // Empty array when no MCP servers are configured
});
```

## Changes Made

### Source Code
- **`src/platform/acp/session-manager.ts`** (line 68): Added `mcpServers: []` to `SessionNewParams`

### Tests
- **`test/unit/acp/session-manager.spec.ts`** (line 66): Updated test expectations to include `mcpServers: []`

## Verification

✅ **All 456 ACP tests passing** (448 unit + 8 integration)
✅ **TypeScript check passes** with no errors
✅ **Extension builds successfully** (227.57 KB)

## Next Steps

1. Uninstall the old extension
2. Install the new build: `copilot-chat-acp-0.33.0.vsix`
3. Reload VS Code
4. Verify the ACP agent successfully creates a new session
5. Test sending messages in the chat UI

## Key Learnings

- The ACP protocol requires `mcpServers` to be present in `SessionNewParams`, even if it's an empty array
- Agent validation schemas may enforce required fields that are marked as optional in TypeScript interfaces
- Always check agent error messages for specific field requirements in the `data._errors` object

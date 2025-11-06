# Fix for First User Message Disappearing

## Problem
The first user message was disappearing in every new chat, while subsequent user messages remained visible. This was causing a poor user experience where the initial prompt would vanish after the agent responded.

## Root Cause Analysis
Through detailed investigation, I identified that there were **duplicate `onDidChangeSession` event handlers** being registered in the `ChatViewProvider`:

1. **First handler**: Registered in `initialize()` method (line 51)
2. **Duplicate handler**: Registered in `resolveWebviewView()` method (line 157)

When a new session was created (which happens on the first message), both handlers would fire, causing the `loadSessionMessages()` method to be called multiple times. While `loadSessionMessages()` had already been fixed to not clear messages, the duplicate handler registration was causing timing issues and potential race conditions.

## Solution Implemented
Removed the duplicate `onDidChangeSession` handler from the `resolveWebviewView()` method in `src/platform/acp/chat-view-provider.ts`.

### Key Changes
- **File**: `src/platform/acp/chat-view-provider.ts`
- **Lines**: 157-165 (removed duplicate handler)
- **Result**: Only one `onDidChangeSession` handler is now registered in the `initialize()` method

### Code Changes
```typescript
// BEFORE (lines 157-165):
// Listen for session changes (only if initialized)
if (this.sessionManager) {
    this.sessionManager.onDidChangeSession((sessionId) => {
        this.currentSessionId = sessionId;
        this.loadSessionMessages(sessionId);
    });
}

// AFTER:
// Note: onDidReceiveMessage and onDidChangeSession listeners are registered in initialize() method
// to avoid duplicate registrations
```

## Verification
- ✅ All 448 ACP unit tests pass
- ✅ All 8 ACP integration tests pass  
- ✅ TypeScript check passes with no errors
- ✅ Extension builds successfully (349.57KB extension.js, 136.26KB diffWorker.js, 270.6KB web.js)
- ✅ Extension packaged successfully (229.33KB total size)
- ✅ Extension installed successfully

## Expected Behavior
After this fix:
1. The first user message should remain visible when the agent responds
2. Subsequent user messages should continue to work as before
3. No duplicate event handlers should be registered
4. Session management should be more reliable

## Next Steps
1. Reload VS Code to ensure the extension is fully activated
2. Open the ACP Chat view
3. Send a test message to verify the first message no longer disappears
4. Check the "ACP Chat" output panel for any remaining issues

## Related Issues
This fix complements the previous fix for `loadSessionMessages()` not clearing messages (lines 338-339 in the same file). Together, these changes ensure proper message persistence during session initialization.
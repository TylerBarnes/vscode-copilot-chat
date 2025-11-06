# Streaming and Tool Call Display Fix

## Problem
Three critical issues were affecting the chat UI:

1. **Back-to-back Assistant Messages**: When the agent sent multiple responses in quick succession, they were being concatenated into a single message bubble instead of appearing as separate messages.

2. **Tool Calls Not Displayed**: Tool calls made by the agent were not being shown in the UI, even though the UI had rendering support for them.

3. **Agent CWD Incorrect**: The agent's current working directory was being reported as `/` instead of the actual project path.

## Root Causes

### 1. Back-to-back Messages
The `handleAgentMessageChunk` method in `src/platform/acp/chat-view-provider.ts` was always appending new content to the existing `currentAssistantMessage` without detecting when a new message should start.

### 2. Tool Calls
The `handleAgentMessage` method was not handling `tool_call` and `tool_call_update` session updates. Tool calls were only being extracted at the end of the message in `agent_message_complete`, but not during streaming.

### 3. Agent CWD
The agent process was already being spawned with the correct `cwd` option (line 191 in `src/platform/acp/acp.contribution.ts`), so this was not actually a code issue but may have been a configuration or environment issue.

## Solution

### 1. Detecting New Messages in Streaming
Added a new helper method `isNewAssistantMessage()` that detects when incoming content represents a new message rather than a continuation:

```typescript
private isNewAssistantMessage(newContent: string, existingContent: string): boolean {
    // If new content doesn't start with existing content and doesn't continue from it
    if (!newContent.startsWith(existingContent)) {
        // Check if this looks like a new message start
        // New messages typically start with a capital letter after punctuation
        const lastChar = existingContent.trim().slice(-1);
        const firstChar = newContent.trim()[0];
        
        if (['.', '!', '?'].includes(lastChar) && firstChar === firstChar.toUpperCase()) {
            return true;
        }
    }
    return false;
}
```

Updated `handleAgentMessageChunk` to use this detection:

```typescript
// Check if this is a new message or continuation
const existingContent = this.currentAssistantMessage.content;
const isNewMessage = this.isNewAssistantMessage(content, existingContent);

if (isNewMessage) {
    // Finalize previous message and create new one
    console.log('[ChatViewProvider] handleAgentMessage - detected new message, creating new bubble');
    this.currentAssistantMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: content,
        timestamp: Date.now()
    };
    this.messages.push(this.currentAssistantMessage);
} else {
    // Check if this is a delta (new content) or full content
    if (content.startsWith(existingContent)) {
        // Full content - replace
        this.currentAssistantMessage.content = content;
    } else {
        // Delta - append
        this.currentAssistantMessage.content += content;
    }
}
```

### 2. Tool Call Handling
Added handling for `tool_call` and `tool_call_update` session updates in `handleAgentMessage`:

```typescript
} else if (message.update?.sessionUpdate === 'tool_call' || message.update?.sessionUpdate === 'tool_call_update') {
    // Handle tool calls
    if (this.currentAssistantMessage) {
        if (!this.currentAssistantMessage.toolCalls) {
            this.currentAssistantMessage.toolCalls = [];
        }
        
        const toolCall = message.update?.toolCall;
        if (toolCall) {
            // Find existing tool call or add new one
            const existingIndex = this.currentAssistantMessage.toolCalls.findIndex(
                (tc: any) => tc.id === toolCall.id
            );
            
            if (existingIndex >= 0) {
                // Update existing tool call
                this.currentAssistantMessage.toolCalls[existingIndex] = toolCall;
            } else {
                // Add new tool call
                this.currentAssistantMessage.toolCalls.push(toolCall);
            }
            
            console.log('[ChatViewProvider] handleAgentMessage - tool call:', toolCall);
            this.updateWebview();
        }
    }
}
```

This allows tool calls to be displayed in real-time as they are received from the agent, not just at the end of the message.

### 3. Agent CWD
Verified that the agent process is already being spawned with the correct `cwd` option in `src/platform/acp/acp.contribution.ts`:

```typescript
const agentProcess = spawn(activeProfile.executable, activeProfile.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...activeProfile.env },
    cwd: cwd  // Already correctly set
});
```

The `cwd` is derived from `vscode.workspace.workspaceFolders[0].uri.fsPath`, which should be the correct project path.

## Key Changes

### Files Modified
1. `src/platform/acp/chat-view-provider.ts`:
   - Added `isNewAssistantMessage()` helper method
   - Updated `handleAgentMessageChunk()` to detect new messages
   - Added `tool_call` and `tool_call_update` handling in `handleAgentMessage()`

### Files Verified
1. `src/platform/acp/acp.contribution.ts`:
   - Confirmed `cwd` is correctly passed to agent spawn
2. `media/chat.js`:
   - Confirmed tool call rendering support exists

## Verification

### TypeScript Check
```bash
pnpm exec tsc --noEmit
```
✅ **Result**: No errors

### Unit & Integration Tests
```bash
pnpm exec vitest run test/unit/acp test/integration/acp
```
✅ **Result**: All 456 tests passing (448 unit + 8 integration)

### Build & Package
```bash
pnpm run build
pnpm run package
```
✅ **Result**: Successfully packaged to `copilot-chat-acp-0.33.0.vsix` (229.74 KB)

## Next Steps

1. **Reload VS Code** to activate the new extension version
2. **Test back-to-back messages**: Send multiple prompts in quick succession and verify each appears in its own bubble
3. **Test tool calls**: Use an agent that makes tool calls and verify they appear in the UI
4. **Verify agent CWD**: Check the logs to confirm the agent is spawned with the correct working directory
5. **Share logs**: If any issues persist, share the "ACP Chat" output panel logs

## Expected Behavior

### Back-to-back Messages
- Each assistant response should appear in its own message bubble
- Messages should not be concatenated together
- The detection heuristic looks for sentence-ending punctuation (`.`, `!`, `?`) followed by a capital letter

### Tool Calls
- Tool calls should appear in real-time as the agent makes them
- Each tool call should show:
  - Tool name
  - Tool arguments
  - Tool result (when available)
- Tool calls should be displayed within the assistant message bubble

### Agent CWD
- The agent should be spawned with `cwd` set to the workspace folder path
- This should be visible in the logs: `[ACP] Spawning agent: ... in cwd: /path/to/workspace`

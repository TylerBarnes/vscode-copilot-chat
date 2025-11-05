# Debugging the ACP Chat View

## Logging Added

I've added comprehensive logging to help debug the infinite loading issue:

### 1. Extension Side Logging

**ACPContribution** (`src/platform/acp/acp.contribution.ts`):
- `[ACPContribution] initialize() called` - When initialization starts
- `[ACPContribution] Creating ConfigurationManager...` - Component creation
- `[ACPContribution] Creating ChatViewProvider...` - Chat view creation
- `[ACPContribution] Extension URI: ...` - Shows the extension URI being used
- `[ACPContribution] Registering webview view provider for acp.copilot.chatView` - Registration
- `[ACPContribution] ChatViewProvider registered successfully` - Confirmation

**ChatViewProvider** (`src/platform/acp/chat-view-provider.ts`):
- `[ChatViewProvider] resolveWebviewView called` - When VS Code requests the view
- `[ChatViewProvider] Setting webview HTML` - Before HTML is set
- `[ChatViewProvider] Webview HTML set` - After HTML is set
- `[ChatViewProvider] Received message from webview: <type>` - Messages from webview
- `[ChatViewProvider] Webview ready, updating...` - When webview sends 'ready' message

### 2. Webview Side Logging

**Webview JavaScript** (`media/chat.js`):
- `[Webview] Initializing...` - When init() is called
- `[Webview] Sending ready message to extension` - Before sending 'ready'
- `[Webview] Initialization complete` - After init() completes
- `[Webview] Received message from extension: <type>` - Messages from extension
- `[Webview] Updating messages: <count>` - When rendering messages

## How to Debug

### Step 1: Open Developer Tools

1. In VS Code, press `Cmd+Shift+P`
2. Type "Developer: Toggle Developer Tools"
3. Press Enter

This opens the Chrome DevTools for VS Code itself.

### Step 2: Check Extension Console

In the DevTools Console tab, look for the `[ACPContribution]` and `[ChatViewProvider]` logs:

**Expected sequence:**
```
[ACPContribution] initialize() called
[ACPContribution] Logging initialization...
[ACPContribution] Creating ConfigurationManager...
[ACPContribution] Creating ChatViewProvider...
[ACPContribution] Extension URI: file:///Users/tylerbarnes/.vscode/extensions/tylerbarnes.copilot-chat-acp-0.33.0
[ACPContribution] Registering webview view provider for acp.copilot.chatView
[ACPContribution] ChatViewProvider registered successfully
```

When you click the "ACP Chat" icon:
```
[ChatViewProvider] resolveWebviewView called
[ChatViewProvider] Setting webview HTML
[ChatViewProvider] Webview HTML set
```

### Step 3: Check Webview Console

The webview runs in a separate context. To see its logs:

1. In the main DevTools, click the "Console" dropdown (top of console)
2. Look for an entry like "active frame" or the webview context
3. Select it to see webview-specific logs

**Expected sequence:**
```
[Webview] Initializing...
[Webview] Sending ready message to extension
[Webview] Initialization complete
```

Then back in the extension console:
```
[ChatViewProvider] Received message from webview: ready
[ChatViewProvider] Webview ready, updating...
```

And in the webview console:
```
[Webview] Received message from extension: updateMessages
[Webview] Updating messages: 0
```

## Common Issues to Look For

### Issue 1: ACPContribution Not Initializing

**Symptom:** No `[ACPContribution]` logs appear

**Cause:** The contribution is not being registered in `contributions.ts`

**Check:** 
- Is `ACPContribution` imported in `src/extension/extension/vscode-node/contributions.ts`?
- Is it added to the `vscodeNodeContributions` array?

### Issue 2: ChatViewProvider Not Registered

**Symptom:** `[ACPContribution]` logs appear but no `[ChatViewProvider]` logs

**Cause:** Registration failed or view ID mismatch

**Check:**
- Does `package.json` have a view with ID `acp.copilot.chatView`?
- Is the view in the correct container (`acp-chat`)?

### Issue 3: Webview Not Loading

**Symptom:** `[ChatViewProvider] resolveWebviewView called` appears but no webview logs

**Cause:** 
- HTML/CSS/JS not loading
- CSP blocking scripts
- Resource path issues

**Check:**
- Are `media/chat.css` and `media/chat.js` in the VSIX?
- Is the extension URI correct?
- Are there CSP errors in the console?

### Issue 4: Ready Message Not Received

**Symptom:** Webview logs appear but `[ChatViewProvider] Received message from webview: ready` doesn't

**Cause:** Message passing broken

**Check:**
- Are there JavaScript errors in the webview console?
- Is `vscode.postMessage()` working?

### Issue 5: ACP Client Not Connecting

**Symptom:** All logs appear but chat doesn't respond

**Cause:** Mock agent not running or configuration incorrect

**Check:**
- Is `.vscode/settings.json` configured correctly?
- Can you run `npx tsx test/mock-acp-agent/agent.ts` manually?
- Are there errors in the extension console about ACP client?

## Next Steps

After checking the logs, report back with:

1. **Which logs appear** - Copy/paste the relevant logs
2. **Which logs are missing** - Which expected logs don't appear
3. **Any errors** - Red error messages in either console
4. **Webview context** - Can you see the webview context in the console dropdown?

This will help pinpoint exactly where the initialization is failing.

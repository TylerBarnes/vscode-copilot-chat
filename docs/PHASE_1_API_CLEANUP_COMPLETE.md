# Phase 1: API Cleanup - COMPLETE

## Changes Made

### 1. Service Registration Fixes (`src/extension/extension/vscode-node/services.ts`)

✅ **IExperimentationService** - Always use `NullExperimentationService`
- Removed conditional logic that tried to use `MicrosoftExperimentationService` in production
- This eliminates the `devDeviceId` API dependency for experimentation/telemetry

✅ **ICopilotTokenManager** - Already using `StubTokenManager`
- Stub implementation avoids GitHub Copilot authentication
- Includes `onDidCopilotTokenRefresh` event

✅ **ISearchService** - Already using `StubSearchService`
- Stub implementation uses basic `vscode.workspace.findFiles` API
- Avoids `findFiles2` proposed API dependency

### 2. Package.json Cleanup

✅ **Removed `enabledApiProposals`** - Completely removed
- No more proposed API dependencies
- Extension now uses only stable VS Code APIs

✅ **Removed Proprietary Contributions:**
- `languageModelTools` - GitHub Copilot tools (not needed for ACP)
- `languageModelToolSets` - Tool sets (not needed for ACP)
- `languageModelChatProviders` - Chat providers (not needed for ACP)
- `chatParticipants` - Legacy chat participants (using custom webview instead)
- `interactiveSession` - Legacy interactive session
- `viewsWelcome` - Welcome views for proprietary features
- `chatViewsWelcome` - Chat welcome views
- `terminalQuickFixes` - Terminal quick fixes
- `chatSessions` - Chat sessions
- `debuggers` - Debugger contributions
- `chatAgents` - Chat agents
- `chatPromptFiles` - Prompt files

### 3. What Remains in package.json

✅ **Essential ACP Contributions:**
- `viewsContainers` - ACP Chat activity bar container
- `views` - Custom webview chat view
- `commands` - ACP-prefixed commands
- `menus` - Command palette and context menus
- `configuration` - ACP settings
- `keybindings` - Keyboard shortcuts
- `icons` - Extension icons
- `iconFonts` - Codicons
- `languages` - Language support
- `walkthroughs` - Getting started guides
- `jsonValidation` - Settings validation
- `typescriptServerPlugins` - TypeScript support

## Expected Results

After reloading VS Code, the extension should:

1. ✅ **Activate without errors** - No more API proposal errors
2. ✅ **No service registration failures** - All services use stubs or stable APIs
3. ✅ **No view container warnings** - Only ACP views are registered
4. ✅ **Custom webview chat loads** - ACP Chat panel should appear
5. ✅ **ACP client connects** - Should connect to configured agent

## Verification Steps

1. **Reload VS Code** - `Cmd+Shift+P` → "Developer: Reload Window"
2. **Open Developer Tools** - `Cmd+Shift+P` → "Developer: Toggle Developer Tools"
3. **Check Console for:**
   - `` - Extension activated
   - `` - ACP contribution initialized
   - `` - Chat view provider created
   - **NO errors about API proposals**
   - **NO errors about unknown services**
4. **Open ACP Chat:**
   - Click "ACP Chat" icon in activity bar
   - Chat panel should load (not infinite loading)
5. **Test Chat:**
   - Type a message
   - Should see connection to mock agent
   - Should receive response

## Next Steps

If activation succeeds:
- Test chat functionality with mock agent
- Verify all ACP components are working
- Move to Phase 4: Configuration & Settings UI testing

If activation still fails:
- Provide console logs
- Identify remaining issues
- Continue debugging

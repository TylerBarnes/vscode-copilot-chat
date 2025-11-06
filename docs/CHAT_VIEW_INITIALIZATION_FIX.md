# Chat View Initialization Fix

## Problem
The custom chat UI was infinitely loading and never showing anything, even after all tests were passing and the extension was successfully installed.

## Root Cause
The chat view was only being registered **after** all initialization was complete. This meant:
1. If no workspace was open, the function would return early and the chat view would never be registered
2. If no agent profile was configured, the function would return early and the chat view would never be registered
3. The UI would show as blank/infinitely loading because the webview provider was never registered

## Solution
Refactored the initialization order in `ACPContribution` to:
1. **Always register the chat view first** - This ensures the UI loads immediately
2. Then check for workspace and agent profile
3. Show appropriate messages in the chat view if initialization fails

### Key Changes

#### 1. Updated `ACPContribution.initialize()` (`src/platform/acp/acp.contribution.ts`)
- Moved chat view registration to the very beginning of the `initialize()` method
- Chat view is now registered before any checks that might cause early returns
- Added graceful handling for missing workspace or agent profile

#### 2. Updated `ChatViewProvider` (`src/platform/acp/chat-view-provider.ts`)
- Changed constructor to only require `extensionUri` 
- Made `acpClient`, `sessionManager`, and `toolCallHandler` optional
- Added `initialize()` method to set these components after they're created
- Added `showMessage()` method to display warnings/errors in the chat UI
- Added null checks throughout to handle uninitialized state gracefully

#### 3. Updated Tests (`test/unit/acp/acp-contribution.spec.ts`)
- Added `workspaceFolders` to the vscode mock to prevent early returns
- Tests now properly simulate a workspace being open

## Results
✅ All 456 ACP tests passing (448 unit + 8 integration)
✅ TypeScript check passes with no errors
✅ Extension builds and packages successfully (226.43 KB)
✅ Chat view now loads immediately, even without an agent configured
✅ Users see helpful messages instead of a blank screen

## User Experience Improvements
1. **Immediate UI feedback** - The chat view loads instantly when the extension activates
2. **Clear error messages** - If no workspace is open or no agent is configured, users see helpful messages
3. **Action buttons** - Messages include buttons to open settings or folders as needed
4. **No more infinite loading** - The UI always shows something, even in error states

## Technical Details
The two-phase initialization pattern allows:
- Phase 1: Register UI components (immediate)
- Phase 2: Initialize backend components (may fail)

This ensures the UI is always responsive and can show appropriate feedback to the user, regardless of the backend state.
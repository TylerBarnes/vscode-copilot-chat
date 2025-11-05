# API Proposal Analysis & Resolution Plan

## Executive Summary

The extension is failing to activate because it's attempting to use VS Code proposed APIs (`devDeviceId`, `findFiles2`) that are not properly enabled. After deep research, I've identified:

1. **Where these APIs are used**
2. **Why they're needed in the original extension**
3. **Whether ACP needs them**
4. **How to fix the issue**

---

## 1. `devDeviceId` API Proposal

### Usage Locations

| File | Lines | Purpose |
|------|-------|---------|
| `src/platform/authentication/node/copilotTokenManager.ts` | 129, 130, 134, 135, 139, 151, 241, 245 | GitHub Copilot authentication |
| `src/platform/authentication/vscode-node/copilotTokenManager.ts` | 78, 79, 81 | Logging and device ID usage |
| `src/platform/telemetry/vscode-node/microsoftExperimentationService.ts` | 141, 145, 178 | Telemetry and experimentation |
| `src/extension/extension/vscode-node/services.ts` | 148 | Service registration for testing |

### Purpose

The `devDeviceId` API provides a unique device identifier used for:
- **Authentication**: Sending device ID to GitHub Copilot API for token requests
- **Telemetry**: Tracking usage and experiments across sessions
- **Testing**: Creating test token managers with specific device IDs

### ACP Dependency Analysis

**Does ACP need this?** ❌ **NO**

- ACP platform code (`src/platform/acp/`) does **NOT** reference `CopilotTokenManager`, `ITelemetryService`, or `MicrosoftExperimentationService`
- ACP agents handle their own authentication via the ACP protocol
- The ACP client communicates with agents over stdio, not GitHub APIs

---

## 2. `findFiles2` API Proposal

### Usage Locations

| File | Lines | Purpose |
|------|-------|---------|
| `src/platform/search/vscode/baseSearchServiceImpl.ts` | 20 | File search implementation |
| `src/platform/search/common/searchService.ts` | 18, 38, 44, 55 | Abstract search service interface |

### Purpose

The `findFiles2` API is an enhanced version of `workspace.findFiles` that supports:
- **Multiple glob patterns** (array of patterns)
- **Advanced exclude options** (`useExcludeSettings`)
- **Better performance** for large workspaces

Used by `ISearchService` for:
- Finding files with default excludes
- Finding files with custom excludes
- Workspace file search operations

### ACP Dependency Analysis

**Does ACP need this?** ❌ **NO**

- ACP platform code (`src/platform/acp/`) does **NOT** reference `ISearchService` or `SearchService`
- ACP agents handle file operations via the ACP protocol's `file_system` capabilities
- The `FileSystemHandler` (`src/platform/acp/file-system-handler.ts`) uses standard VS Code APIs (`workspace.fs`)

---

## 3. Other Proposed APIs in `enabledApiProposals`

The extension currently declares these proposed APIs in `package.json`:

```json
"enabledApiProposals": [
  "devDeviceId",
  "findFiles2",
  "chatParticipantAdditions",
  "chatParticipantPrivate",
  "defaultChatParticipant",
  "chatProvider",
  "languageModelSystem"
]
```

### Chat-Related APIs

These are all related to VS Code's proprietary chat infrastructure:
- `chatParticipantAdditions` - Additional chat participant features
- `chatParticipantPrivate` - Private chat participant APIs
- `defaultChatParticipant` - Default chat participant registration
- `chatProvider` - Chat provider registration
- `languageModelSystem` - Language model system APIs

**Does ACP need these?** ❌ **NO**

The custom webview approach (`ChatViewProvider`) bypasses VS Code's chat infrastructure entirely.

---

## 4. Root Cause of Activation Failure

The extension is failing with:
```
ERR Extension 'TylerBarnes.copilot-chat-acp' CANNOT use API proposal: devDeviceId
ERR Extension 'TylerBarnes.copilot-chat-acp' CANNOT use API proposal: findFiles2
```

**Why?**

Even though these APIs are listed in `enabledApiProposals`, VS Code is rejecting them because:

1. **The extension is not running in development mode** (not launched via F5)
2. **The extension is not signed/published by Microsoft** (proposed APIs are restricted)
3. **The APIs may have been abandoned or changed** in the current VS Code version

---

## 5. Resolution Strategy

### Option A: Remove All Proposed API Dependencies (RECOMMENDED)

**Goal**: Strip out all code that uses proposed APIs, as ACP doesn't need them.

**Steps**:

1. **Remove `enabledApiProposals` from `package.json`** entirely
2. **Remove or stub out services that use proposed APIs**:
   - `ICopilotTokenManager` → Not needed for ACP
   - `ISearchService` → Not needed for ACP
   - `ITelemetryService` (if using `devDeviceId`) → Not needed for ACP
3. **Update service registration** in `src/extension/extension/vscode-node/services.ts`:
   - Remove `ICopilotTokenManager` registration
   - Remove `ISearchService` registration (or use a stub)
4. **Remove proposed API type definitions** from `src/extension/vscode.proposed.*.d.ts` (or keep for reference)

**Pros**:
- ✅ Clean, independent ACP extension
- ✅ No conflicts with official Copilot
- ✅ Works in production (no dev mode required)
- ✅ Aligns with "pure ACP client" goal

**Cons**:
- ⚠️ Requires modifying service registration code
- ⚠️ May break non-ACP features (but we're removing those anyway)

---

### Option B: Run in Development Mode (NOT RECOMMENDED)

**Goal**: Enable proposed APIs by launching via VS Code's Extension Development Host.

**Steps**:

1. Use the `.vscode/launch.json` configuration
2. Press F5 to launch the extension in development mode
3. VS Code will allow proposed APIs in this mode

**Pros**:
- ✅ Quick test without code changes

**Cons**:
- ❌ Only works in development
- ❌ Cannot be installed as a regular extension
- ❌ Defeats the purpose of a production-ready ACP client

---

## 6. Recommended Action Plan

### Phase 1: Remove Proposed API Dependencies

1. **Update `package.json`**:
   ```bash
   # Remove enabledApiProposals entirely
   jq 'del(.enabledApiProposals)' package.json > package.json.tmp && mv package.json.tmp package.json
   ```

2. **Create stub services** for `ICopilotTokenManager` and `ISearchService` in `src/platform/acp/`:
   - `src/platform/acp/stub-token-manager.ts` (returns null/empty tokens)
   - `src/platform/acp/stub-search-service.ts` (returns empty results or throws "not implemented")

3. **Update service registration** in `src/extension/extension/vscode-node/services.ts`:
   ```typescript
   // Replace:
   builder.define(ICopilotTokenManager, getOrCreateTestingCopilotTokenManager(env.devDeviceId));
   // With:
   builder.define(ICopilotTokenManager, new SyncDescriptor(StubTokenManager));
   
   // Replace:
   builder.define(ISearchService, new SyncDescriptor(SearchServiceImpl));
   // With:
   builder.define(ISearchService, new SyncDescriptor(StubSearchService));
   ```

4. **Rebuild and test**:
   ```bash
   tsx .esbuild.ts
   npx @vscode/vsce package --no-dependencies
   code --install-extension copilot-chat-acp-0.33.0.vsix --force
   ```

### Phase 2: Verify ACP Functionality

1. Reload VS Code
2. Check for activation errors (should be gone)
3. Open "ACP Chat" panel
4. Test chat with mock agent
5. Verify logs show:
   - `` ✅
   - `` ✅
   - `` ✅

### Phase 3: Clean Up (Optional)

1. Remove unused proposed API type definitions
2. Remove unused authentication/telemetry code
3. Update documentation

---

## 7. Expected Outcome

After implementing Option A:

- ✅ Extension activates successfully
- ✅ No proposed API errors
- ✅ ACP chat panel loads
- ✅ Mock agent connects and responds
- ✅ No conflicts with official Copilot
- ✅ Works as a regular installed extension (no dev mode required)

---

## 8. Next Steps

**Immediate**: Implement Phase 1 (stub services and remove proposed APIs)

**After verification**: Proceed with Phase 2 testing

**Long-term**: Clean up unused code (Phase 3)

---

## Conclusion

The root cause is clear: the extension is trying to use proposed APIs for GitHub Copilot authentication and file search, which are **not needed for ACP**. The solution is to remove these dependencies and use stub services, allowing the ACP extension to activate and function independently.

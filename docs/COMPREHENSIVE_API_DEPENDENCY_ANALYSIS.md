# Comprehensive API Dependency Analysis

## Current Activation Failures

Based on the latest console logs, the extension is failing to activate due to:

1. **Proposed API Issues:**
   - `findFiles2` - API proposal does not exist
   - `devDeviceId` - API proposal does not exist (already addressed with stub)
   - `defaultChatParticipant` - Cannot use API proposal
   - `chatParticipantAdditions` - Cannot use API proposal
   - `chatParticipantPrivate` - Cannot use API proposal
   - `contribLanguageModelToolSets` - Cannot register language model tools

2. **Service Registration Issues:**
   - `IExperimentationService` - Unknown service identifier
   - View container `agentSessions` does not exist

3. **Contribution Point Conflicts:**
   - Language model tools registration blocked
   - Default chat participant blocked
   - Chat participant additions blocked

## Detailed Analysis

### 1. findFiles2 API

**Usage:**
- `src/platform/search/vscode/baseSearchServiceImpl.ts:20` - Implements `ISearchService.findFiles2()`
- `src/extension/vscode.proposed.findFiles2.d.ts:123` - Type definition

**Dependencies:**
- Used by `ISearchService` interface
- Consumed by `IgnoreService` and `SearchServiceImpl`
- **NOT used by ACP platform**

**Resolution:**
- Already created `StubSearchService` but need to update service registration
- Remove `findFiles2` from `enabledApiProposals`

### 2. devDeviceId API

**Usage:**
- `src/platform/authentication/node/copilotTokenManager.ts` - GitHub Copilot authentication
- `src/platform/telemetry/vscode-node/microsoftExperimentationService.ts` - Telemetry/experimentation

**Dependencies:**
- Used by `CopilotTokenManager` for GitHub authentication
- Used by `MicrosoftExperimentationService` for telemetry
- **NOT used by ACP platform**

**Resolution:**
- Already created `StubTokenManager` with `onDidCopilotTokenRefresh` event
- Need to address `IExperimentationService` dependency
- Remove `devDeviceId` from `enabledApiProposals`

### 3. IExperimentationService

**Usage:**
- `src/extension/extension/vscode-node/services.ts:206` - Registers `MicrosoftExperimentationService`
- Used by 20+ files for A/B testing and feature flags
- **NOT used by ACP platform**

**Current Registration:**
```typescript
if (ExtensionMode.Production === extensionContext.extensionMode && !isScenarioAutomation) {
    builder.define(IExperimentationService, new SyncDescriptor(MicrosoftExperimentationService));
} else {
    builder.define(IExperimentationService, new NullExperimentationService());
}
```

**Problem:**
- `MicrosoftExperimentationService` constructor requires `devDeviceId` API
- Service is registered but fails to instantiate in production mode

**Resolution:**
- Always use `NullExperimentationService` instead of `MicrosoftExperimentationService`
- This avoids the `devDeviceId` dependency entirely

### 4. languageModelTools

**Usage:**
- `package.json` - Contributes `languageModelTools` for GitHub Copilot
- `src/extension/tools/` - Implements various tools (EditFile, SearchWeb, etc.)
- **NOT needed for ACP** (ACP agents provide their own tools via MCP)

**Current State:**
- Still present in `package.json` under `contributes.languageModelTools`
- Blocked by missing `contribLanguageModelToolSets` API proposal

**Resolution:**
- Remove `languageModelTools` from `package.json`
- Remove `contribLanguageModelToolSets` from `enabledApiProposals`

### 5. chatParticipant APIs

**Usage:**
- `defaultChatParticipant` - Marks a chat participant as the default
- `chatParticipantAdditions` - Adds additional capabilities to chat participants
- `chatParticipantPrivate` - Private chat participant APIs

**Current State:**
- Present in `enabledApiProposals`
- Used by the legacy chat participant system
- **NOT needed for ACP** (using custom webview instead)

**Resolution:**
- Remove these from `enabledApiProposals`
- Remove legacy `chatParticipants` from `package.json` (keep only webview)

### 6. View Container Issues

**Problem:**
- Console shows: `View container 'agentSessions' does not exist`
- This is because we removed it from `viewsContainers` but code still references it

**Resolution:**
- Either restore the container or remove code that references it

## Comprehensive Resolution Plan

### Phase 1: Service Registration Fixes

1. **Update `src/extension/extension/vscode-node/services.ts`:**
   - Always use `NullExperimentationService` (remove conditional)
   - Update `ISearchService` registration to use `StubSearchService`
   - Verify `ICopilotTokenManager` uses `StubTokenManager`

### Phase 2: Remove Proprietary API Dependencies

2. **Update `package.json`:**
   - Remove ALL entries from `enabledApiProposals`
   - Remove `languageModelTools` contribution
   - Remove legacy `chatParticipants` (keep only webview view)
   - Remove `languageModelChatProviders` contribution
   - Keep only: `viewsContainers`, `views` (webview), `commands`, `menus`, `configuration`

### Phase 3: Clean Up Source Code

3. **Remove/stub unused services:**
   - Ensure no code tries to use `MicrosoftExperimentationService`
   - Ensure no code tries to use `CopilotTokenManager`
   - Ensure no code tries to use `SearchService` with `findFiles2`

### Phase 4: Verify ACP Components

4. **Ensure ACP components are properly registered:**
   - `ACPContribution` is in `contributions.ts`
   - `ChatViewProvider` is registered
   - All ACP services are available

## Expected Outcome

After these changes:
- Extension should activate without API proposal errors
- No service registration errors
- No view container warnings
- Custom webview chat should load
- ACP client should connect to configured agent

## Files to Modify

1. `src/extension/extension/vscode-node/services.ts` - Service registration
2. `package.json` - Remove proprietary contributions and API proposals
3. Potentially remove unused code in `src/extension/tools/`, `src/extension/completions/`, etc.

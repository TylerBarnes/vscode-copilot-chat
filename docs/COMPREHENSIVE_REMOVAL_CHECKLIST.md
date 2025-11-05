# Comprehensive Removal Checklist for ACP Transformation

**Status:** ✅ Complete  
**Date:** 2025-01-XX  
**Total Files to Modify:** ~1,500+  
**Risk Level:** High (breaking changes throughout)

## Executive Summary

This checklist consolidates findings from all 7 research phases to provide a complete action plan for transforming the `vscode-copilot-chat` extension into a pure ACP client. The transformation requires removing ~80% of the existing codebase and replacing it with ACP-native implementations.

---

## Phase 1: Immediate Critical Fixes
**Goal:** Get extension to activate without errors

### 1.1 Fix `contributions.ts` File
**File:** `src/extension/extension/vscode-node/contributions.ts`

- [ ] Comment out `CompletionsCoreContribution` import and registration
- [ ] Comment out `InlineEditProviderFeature` import and registration  
- [ ] Comment out `InlineCompletionContribution` import and registration
- [ ] Comment out `ChatParticipantContribution` import and registration
- [ ] Comment out `ChatSessionsContrib` import and registration
- [ ] Comment out `ConversationFeature` import and registration
- [ ] Comment out `ToolsContribution` import and registration
- [ ] Comment out `RelatedFilesContribution` import and registration
- [ ] Comment out `TelemetryContribution` import and registration
- [ ] Comment out `AuthenticationContribution` import and registration
- [ ] Comment out `NotebookContribution` import and registration
- [ ] Keep only `ACPContribution` and `ContextKeysContribution`

### 1.2 Rebuild and Test
- [ ] Run `pnpm run build`
- [ ] Verify no `inlineCompletionsAdditions` in `dist/extension.js`
- [ ] Run `pnpm run package`
- [ ] Uninstall old extension: `code --uninstall-extension TylerBarnes.copilot-chat-acp`
- [ ] Install new extension: `code --install-extension copilot-chat-acp-0.33.0.vsix`
- [ ] Verify extension activates without errors
- [ ] Verify custom chat webview loads

---

## Phase 2: Remove Proprietary Components
**Goal:** Delete all GitHub Copilot-specific code

### 2.1 Extension Components (~800 files)

#### Completions System
- [ ] Delete `src/extension/completions/` directory (~100 files)
- [ ] Delete `src/extension/completions-core/` directory (~100 files)
- [ ] Delete `src/extension/inlineEdits/` directory (~120 files)
- [ ] Delete `test/unit/completions/` directory (~150 tests)
- [ ] Delete `test/unit/completions-core/` directory (~100 tests)
- [ ] Delete `test/unit/inlineEdits/` directory (~120 tests)

#### Chat System
- [ ] Delete `src/extension/chat/` directory (~50 files)
- [ ] Delete `src/extension/chatSessions/` directory (~40 files)
- [ ] Delete `src/extension/conversation/` directory (~60 files)
- [ ] Delete `test/unit/chat/` directory (~80 tests)
- [ ] Delete `test/unit/chatSessions/` directory (~60 tests)
- [ ] Delete `test/unit/conversation/` directory (~40 tests)

#### Tools System
- [ ] Delete `src/extension/tools/` directory (~80 files)
- [ ] Delete `src/extension/relatedFiles/` directory (~15 files)
- [ ] Delete `test/unit/tools/` directory (~100 tests)
- [ ] Delete `test/unit/relatedFiles/` directory (~10 tests)

#### Agent System
- [ ] Delete `src/extension/agents/copilotcli/` directory (~20 files)
- [ ] Delete `src/extension/externalAgents/` directory (~30 files)
- [ ] Delete `test/unit/agents/copilotcli/` directory (~30 tests)

#### Supporting Features
- [ ] Delete `src/extension/telemetry/` directory (~40 files)
- [ ] Delete `src/extension/authentication/` directory (~30 files)
- [ ] Delete `src/extension/notebook/` directory (~50 files)
- [ ] Delete `test/unit/telemetry/` directory (~20 tests)
- [ ] Delete `test/unit/authentication/` directory (~30 tests)
- [ ] Delete `test/unit/notebook/` directory (~40 tests)

#### Library
- [ ] Delete `src/lib/` directory (~10 files)

### 2.2 Platform Components (~200 files)

#### Authentication System
- [ ] Delete `src/platform/authentication/node/copilotTokenManager.ts`
- [ ] Delete `src/platform/authentication/vscode-node/copilotTokenManager.ts`
- [ ] Delete `src/platform/authentication/vscode-node/session.ts`
- [ ] Delete `src/platform/authentication/vscode-node/authenticationService.ts`

#### Configuration System
- [ ] Delete `src/platform/configuration/vscode/configurationServiceImpl.ts`
- [ ] Create new `src/platform/acp/configuration-service.ts`

#### Infrastructure Components
- [ ] Delete `src/platform/github/` directory (~10 files)
- [ ] Delete `src/platform/embeddings/` directory (~15 files)
- [ ] Delete `src/platform/remoteCodeSearch/` directory (~10 files)
- [ ] Delete `src/platform/chunking/` directory (~5 files)
- [ ] Delete `src/platform/endpoint/` directory (~20 files)
- [ ] Delete `src/platform/networking/` directory (~10 files)
- [ ] Delete `src/platform/notebook/` directory (~10 files)
- [ ] Delete `src/platform/image/` directory (~5 files)
- [ ] Delete `src/platform/review/` directory (~10 files)
- [ ] Delete `src/platform/heatmap/` directory (~5 files)
- [ ] Delete `src/platform/ignore/` directory (~10 files)
- [ ] Delete `src/platform/multiFileEdit/` directory (~20 files)

### 2.3 Package.json Cleanup

#### Commands (89 entries)
- [ ] Remove all `github.copilot.*` commands from `contributes.commands`
- [ ] Keep only `acp.copilot.*` commands

#### Configuration (56 entries)
- [ ] Remove all `github.copilot.*` configuration from `contributes.configuration`
- [ ] Add new `acp.chat.*` configuration schema

#### Other Contributions
- [ ] Remove all `languageModelTools` entries
- [ ] Remove all `languageModelChatProviders` entries
- [ ] Remove all `chatParticipants` entries
- [ ] Remove all `chatViewsWelcome` entries
- [ ] Remove all `terminalQuickFixes` entries
- [ ] Remove all `chatSessions` entries
- [ ] Remove all `debuggers` entries
- [ ] Remove all `chatAgents` entries
- [ ] Remove all `chatPromptFiles` entries
- [ ] Remove all menu items referencing `github.copilot.*`

---

## Phase 3: Update Service Registration
**Goal:** Clean up service dependencies

### 3.1 Services.ts Updates
**File:** `src/extension/extension/vscode-node/services.ts`

#### Services to Remove
- [ ] Remove `ICopilotTokenManager` registration (keep stub)
- [ ] Remove `IAuthenticationService` registration
- [ ] Remove `IChatAgentService` registration
- [ ] Remove `IToolsService` registration
- [ ] Remove `IRelatedFilesService` registration
- [ ] Remove `ITelemetryService` registration (keep basic logging)
- [ ] Remove `INotebookService` registration
- [ ] Remove `IEmbeddingsComputer` registration
- [ ] Remove `IRemoteCodeSearchService` registration
- [ ] Remove `IGithubRepositoryService` registration
- [ ] Remove `IOctoKitService` registration
- [ ] Remove `IImageService` registration
- [ ] Remove `IReviewService` registration
- [ ] Remove `IHeatmapService` registration
- [ ] Remove `IIgnoreService` registration

#### Services to Keep/Update
- [ ] Keep `IWorkspaceService`
- [ ] Keep `IFileSystemService`
- [ ] Keep `ITerminalService`
- [ ] Keep `StubSearchService` for `ISearchService`
- [ ] Keep `ILanguageFeaturesService`
- [ ] Keep `IGitService`
- [ ] Keep `IDialogService`
- [ ] Update `INotificationService` (remove Copilot-specific methods)
- [ ] Keep `IWorkbenchService`
- [ ] Keep `IEditingService`
- [ ] Keep `IDiffService`
- [ ] Keep `IEnvService`
- [ ] Keep `IExtensionsService`
- [ ] Keep `ITestProvider`
- [ ] Keep `IScopeSelector`
- [ ] Keep `ILogService`
- [ ] Replace `IConfigurationService` with ACP version
- [ ] Keep `NullExperimentationService` for `IExperimentationService`

---

## Phase 4: Adapt Reusable Components
**Goal:** Modify components that can be reused

### 4.1 Context Keys
**Directory:** `src/extension/contextKeys/`

- [ ] Update all context key names from `github.copilot.*` to `acp.copilot.*`
- [ ] Remove Copilot token status checks
- [ ] Simplify to basic UI state management
- [ ] Update tests to match new names

### 4.2 Claude Agent Integration
**Directory:** `src/extension/agents/claude/`

- [ ] Replace VS Code chat APIs with ACP protocol
- [ ] Update to use `ACPClient` instead of `vscode.ChatRequest`
- [ ] Remove dependency on `IToolsService`
- [ ] Update to use ACP tool system
- [ ] Update tests for ACP integration

### 4.3 BYOK (Bring Your Own Key)
**Directory:** `src/extension/byok/`

- [ ] Replace `vscode.lm.*` APIs with ACP configuration
- [ ] Update model configuration to be agent-specific
- [ ] Remove dependency on `IAuthenticationService`
- [ ] Update tests for ACP configuration

### 4.4 Prompts System
**Directory:** `src/extension/prompts/`

- [ ] Extract reusable prompt templates
- [ ] Remove Copilot-specific prompts
- [ ] Remove dependency on `@vscode/prompt-tsx`
- [ ] Create ACP-compatible prompt system
- [ ] Update tests for ACP prompts

### 4.5 MCP Integration
**Directory:** `src/extension/mcp/`

- [ ] Keep `IMCPManager` reference
- [ ] Remove VS Code-specific tool registration
- [ ] Update to use ACP tool system
- [ ] Verify integration with `MCPManager` from Phase 2

### 4.6 Extension API
**Directory:** `src/extension/api/`

- [ ] Replace `CopilotExtensionApi` with `ACPExtensionApi`
- [ ] Update API to expose ACP functionality
- [ ] Remove Copilot-specific methods
- [ ] Update type definitions
- [ ] Create new documentation

### 4.7 Logging System
**File:** `src/platform/log/vscode/outputChannelLogTarget.ts`

- [ ] Rename output channel from "GitHub Copilot Chat" to "ACP Chat"
- [ ] Update any Copilot-specific log messages
- [ ] Keep core logging infrastructure

### 4.8 Thinking Service
**Directory:** `src/platform/thinking/`

- [ ] Make provider-agnostic (remove Azure/Copilot specifics)
- [ ] Support generic thinking step format
- [ ] Update tests for generic format

---

## Phase 5: Implement ACP-Native Replacements
**Goal:** Build new ACP-specific features

### 5.1 ACP Chat System
**New Directory:** `src/extension/acp-chat/`

- [ ] Create `ACPChatParticipant` class
- [ ] Implement chat message handling via `ACPClient`
- [ ] Create chat history management
- [ ] Implement streaming responses
- [ ] Add error handling and recovery
- [ ] Create comprehensive tests (~30 tests)

### 5.2 ACP Session Management
**New Directory:** `src/extension/acp-sessions/`

- [ ] Create `ACPSessionProvider` class
- [ ] Implement session lifecycle (start/end/list)
- [ ] Add session persistence
- [ ] Implement session switching
- [ ] Add session export/import
- [ ] Create comprehensive tests (~20 tests)

### 5.3 ACP Tool System
**New Directory:** `src/extension/acp-tools/`

- [ ] Create `ACPToolRegistry` class
- [ ] Implement tool discovery
- [ ] Add tool invocation handling
- [ ] Implement tool result processing
- [ ] Add permission checking
- [ ] Create comprehensive tests (~20 tests)

### 5.4 ACP Agent Management
**New Directory:** `src/extension/acp-agents/`

- [ ] Create `ACPAgentRegistry` class
- [ ] Implement agent discovery
- [ ] Add agent profile management
- [ ] Implement agent switching
- [ ] Add agent health monitoring
- [ ] Create comprehensive tests (~20 tests)

### 5.5 ACP Extension API
**New Directory:** `src/extension/acp-api/`

- [ ] Create `ACPExtensionApi` class
- [ ] Expose ACP client functionality
- [ ] Add event emitters for ACP events
- [ ] Implement helper methods
- [ ] Create API documentation
- [ ] Create comprehensive tests (~10 tests)

### 5.6 Custom Chat UI Enhancements
**Directory:** `src/platform/acp/`

- [ ] Fix webview loading issues
- [ ] Implement message rendering
- [ ] Add thinking steps display
- [ ] Implement agent plan viewer
- [ ] Add session mode switcher
- [ ] Implement slash command support
- [ ] Add file attachments
- [ ] Implement tool call visualization
- [ ] Add error display
- [ ] Create comprehensive tests (~30 tests)

---

## Phase 6: Testing & Verification
**Goal:** Ensure everything works correctly

### 6.1 Unit Testing
- [ ] Run all 459 existing ACP tests
- [ ] Fix any failing tests
- [ ] Add new tests for ACP-native components (~100 tests)
- [ ] Achieve >80% code coverage

### 6.2 Integration Testing
- [ ] Test with mock ACP agent
- [ ] Test with OpenCode agent
- [ ] Test with Claude Code agent (if ACP-compatible)
- [ ] Test MCP server integration
- [ ] Test file system operations
- [ ] Test terminal operations
- [ ] Test permission system

### 6.3 E2E Testing
- [ ] Create E2E test suite for chat flow
- [ ] Test session management
- [ ] Test tool invocation
- [ ] Test agent switching
- [ ] Test error recovery
- [ ] Test performance

### 6.4 Manual Testing
- [ ] Install extension in clean VS Code
- [ ] Verify all UI elements work
- [ ] Test all commands
- [ ] Test all settings
- [ ] Test with different agents
- [ ] Document any issues

---

## Phase 7: Documentation & Polish
**Goal:** Prepare for release

### 7.1 Documentation
- [ ] Update README.md for ACP
- [ ] Create MIGRATION.md guide
- [ ] Update CONTRIBUTING.md
- [ ] Create ACP_AGENT_GUIDE.md
- [ ] Update all code comments
- [ ] Generate API documentation

### 7.2 Configuration
- [ ] Create default ACP settings
- [ ] Add configuration migration
- [ ] Create settings UI
- [ ] Add first-run experience
- [ ] Create agent setup wizard

### 7.3 Performance
- [ ] Profile extension startup
- [ ] Optimize bundle size
- [ ] Reduce memory usage
- [ ] Improve response times
- [ ] Add performance monitoring

### 7.4 Polish
- [ ] Update extension icon
- [ ] Update marketplace description
- [ ] Create demo videos
- [ ] Add telemetry (optional)
- [ ] Final bug fixes

---

## Risk Mitigation Strategies

### High Risk Items
1. **Extension Activation Errors**
   - Mitigation: Systematically disable contributions one by one
   - Fallback: Create minimal extension from scratch

2. **Custom Chat UI Issues**
   - Mitigation: Use proven webview patterns from other extensions
   - Fallback: Create simpler UI initially

3. **Agent Compatibility**
   - Mitigation: Test with multiple ACP agents early
   - Fallback: Focus on mock agent initially

### Medium Risk Items
1. **Performance Degradation**
   - Mitigation: Profile and optimize critical paths
   - Fallback: Accept some performance loss initially

2. **Missing Features**
   - Mitigation: Prioritize core chat functionality
   - Fallback: Document limitations clearly

3. **Test Coverage**
   - Mitigation: Focus on critical path testing
   - Fallback: Add tests incrementally

---

## Success Metrics

### Week 1 Goals
- ✅ Extension activates without errors
- ✅ Custom chat UI loads
- ✅ Mock agent connects
- ✅ Basic chat works

### Week 2 Goals
- ✅ All proprietary code removed
- ✅ Core ACP features working
- ✅ 500+ tests passing
- ✅ Multiple agents tested

### Week 3 Goals
- ✅ All ACP features implemented
- ✅ 600+ tests passing
- ✅ Performance acceptable
- ✅ Documentation complete

### Week 4 Goals
- ✅ Extension ready for release
- ✅ All tests passing
- ✅ User feedback incorporated
- ✅ Published to marketplace

---

## Timeline Summary

| Phase | Status |
|-------|--------|
| Phase 1: Critical Fixes | 🔴 Ready |
| Phase 2: Remove Components | 🔴 Ready |
| Phase 3: Update Services | 🔴 Ready |
| Phase 4: Adapt Components | 🟡 Ready |
| Phase 5: Build Replacements | 🟡 Ready |
| Phase 6: Testing | 🟢 Ready |
| Phase 7: Documentation | 🟢 Ready |
| **TOTAL** | **Ready to Execute** |

---

## Next Steps

1. **Get User Approval** - Present this checklist for review
2. **Execute Phase 1** - Fix critical activation errors
3. **Verify Success** - Ensure extension loads without errors
4. **Continue Phases 2-7** - Follow checklist systematically
5. **Regular Check-ins** - Update user on progress

---

**Document Status:** ✅ Complete  
**Confidence Level:** High (comprehensive analysis completed)  
**Recommendation:** Proceed with Phase 1 immediately after user approval
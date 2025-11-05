# Extension Component Inventory

**Purpose**: Comprehensive catalog of all components in the vscode-copilot-chat extension to understand what we've inherited and what makes sense for an ACP-based extension.

**Status**: 🔴 Research Phase - No code changes yet

---

## Directory Structure Overview

Total TypeScript files (excluding tests and .d.ts): **609 files**

### Top-Level Extension Directories (47 total)

1. **agents** - Agent-related functionality
2. **api** - Public API surface
3. **authentication** - GitHub authentication & token management
4. **byok** - Bring Your Own Key functionality
5. **chat** - Core chat functionality
6. **chatSessions** - Session management
7. **codeBlocks** - Code block rendering/handling
8. **commands** - VS Code command registrations
9. **common** - Shared utilities and constants
10. **completions** - Inline completions (ghost text)
11. **completions-core** - Core completion engine
12. **configuration** - Settings and configuration
13. **context** - Context gathering for prompts
14. **contextKeys** - VS Code context key management
15. **conversation** - Conversation state management
16. **conversationStore** - Conversation persistence
17. **extension** - Extension entry points (node/worker/common)
18. **externalAgents** - External agent integrations
19. **getting-started** - Onboarding/walkthrough
20. **git** - Git integration
21. **ignore** - .copilotignore file handling
22. **inlineChat** - Inline chat widget (Ctrl+I)
23. **inlineEdits** - Inline edit suggestions
24. **intents** - Intent detection/routing
25. **languageContextProvider** - Language-specific context
26. **linkify** - Link detection in chat
27. **log** - Logging infrastructure
28. **mcp** - Model Context Protocol integration
29. **notebook** - Jupyter notebook support
30. **onboardDebug** - Debug onboarding
31. **prompt** - Prompt engineering/templates
32. **promptFileContext** - File context for prompts
33. **prompts** - Prompt library/management
34. **relatedFiles** - Related file detection
35. **renameSuggestions** - Symbol rename suggestions
36. **replay** - Chat replay functionality
37. **review** - Code review features
38. **search** - Workspace search integration
39. **settingsSchema** - Settings JSON schema
40. **survey** - User surveys
41. **telemetry** - Telemetry/analytics
42. **test** - Test infrastructure
43. **testing** - Test runner integration
44. **tools** - Tool calling infrastructure
45. **typescriptContext** - TypeScript-specific context
46. **workspaceChunkSearch** - Chunked workspace search
47. **workspaceRecorder** - Workspace activity recording
48. **workspaceSemanticSearch** - Semantic search
49. **xtab** - Cross-tab communication

---

## Platform Layer (`src/platform`)

The platform layer provides abstractions for:
- Authentication
- Chat
- Configuration
- File system
- Heatmap
- Ignore files
- Language models
- Logging
- MCP
- Notebook
- Review
- Search
- Telemetry
- Testing
- And more...

---

## ACP-Specific Components (Our Work)

Located in `src/platform/acp/`:

1. **types.ts** - ACP protocol type definitions
2. **json-rpc-client.ts** - JSON-RPC 2.0 client
3. **acp-client.ts** - Main ACP client
4. **agent-config-manager.ts** - Agent configuration
5. **file-system-handler.ts** - File system operations
6. **terminal-manager.ts** - Terminal control
7. **permission-handler.ts** - Permission management
8. **mcp-manager.ts** - MCP server management
9. **request-handler.ts** - Request processing
10. **content-block-mapper.ts** - Content block mapping
11. **session-manager.ts** - Session lifecycle
12. **tool-call-handler.ts** - Tool call execution
13. **chat-participant.ts** - VS Code chat participant
14. **agent-plan-viewer.ts** - Agent plan visualization
15. **thinking-steps-display.ts** - Thinking steps UI
16. **session-mode-switcher.ts** - Session mode management
17. **slash-command-handler.ts** - Slash command support
18. **acp.contribution.ts** - Extension activation
19. **chat-view-provider.ts** - Custom webview chat UI
20. **stub-token-manager.ts** - Stub for token management
21. **stub-search-service.ts** - Stub for search service
22. **configuration-manager.ts** - Configuration management
23. **agent-profile-selector.ts** - Agent profile selection
24. **mcp-server-config-ui.ts** - MCP server configuration UI
25. **permission-policy-manager.ts** - Permission policy management
26. **settings-webview.ts** - Settings webview

---

## Key Questions to Answer

For each component, we need to determine:

1. **Purpose**: What does this component do?
2. **Dependencies**: What does it depend on?
3. **ACP Relevance**: Is this relevant for an ACP-based extension?
4. **Conflicts**: Does this conflict with ACP architecture?
5. **Action**: Keep, Remove, Replace, or Stub?

---

## Analysis Strategy

We'll analyze components in this order:

### Phase 1: Extension Entry Points
- `src/extension/extension/` - Understand how the extension activates
- `src/extension/extension/vscode-node/contributions.ts` - What gets registered
- `src/extension/extension/vscode-node/services.ts` - What services are created

### Phase 2: Core Chat Infrastructure
- `src/extension/chat/` - Core chat functionality
- `src/extension/conversation/` - Conversation management
- `src/extension/chatSessions/` - Session management

### Phase 3: Proprietary Features (Likely to Remove)
- `src/extension/authentication/` - GitHub authentication
- `src/extension/completions/` - Inline completions
- `src/extension/completions-core/` - Completion engine
- `src/extension/inlineChat/` - Inline chat widget
- `src/extension/inlineEdits/` - Inline edits

### Phase 4: Context & Tools
- `src/extension/context/` - Context gathering
- `src/extension/tools/` - Tool infrastructure
- `src/extension/prompt/` - Prompt engineering

### Phase 5: Supporting Features
- `src/extension/review/` - Code review
- `src/extension/testing/` - Test integration
- `src/extension/notebook/` - Notebook support
- `src/extension/git/` - Git integration

### Phase 6: Infrastructure
- `src/extension/telemetry/` - Telemetry
- `src/extension/log/` - Logging
- `src/extension/configuration/` - Configuration

---

## Next Steps

1. ✅ Create this inventory document
2. 🔄 Analyze Phase 1: Extension Entry Points
3. ⏳ Analyze Phase 2: Core Chat Infrastructure
4. ⏳ Analyze Phase 3: Proprietary Features
5. ⏳ Analyze Phase 4: Context & Tools
6. ⏳ Analyze Phase 5: Supporting Features
7. ⏳ Analyze Phase 6: Infrastructure
8. ⏳ Create removal/refactoring plan
9. ⏳ Implement changes with full test coverage

---

## Notes

- This is a **research phase** - no code changes yet
- We're building a complete understanding before making decisions
- Each component will get its own detailed analysis document
- We'll identify all VS Code proprietary API dependencies
- We'll create a comprehensive removal/refactoring plan

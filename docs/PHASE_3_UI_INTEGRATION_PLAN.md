# Phase 3: UI Integration Plan

## Overview

Phase 3 transforms the VS Code extension's UI layer to work with the ACP client instead of the GitHub Copilot API. This is the most complex phase as it involves replacing the entire request/response flow while maintaining the existing user experience.

## Current Architecture Analysis

### Current Flow
1. **User Input** → VS Code Chat Panel/Inline Chat
2. **Chat Participant** (`chatParticipants.ts`) → Registers agents with VS Code
3. **Request Handler** (`chatParticipantRequestHandler.ts`) → Orchestrates the flow
4. **Intent Selection** → Determines which intent to use (Agent, Edit, Generate, etc.)
5. **Intent Execution** (`agentIntent.ts`, etc.) → Builds prompts using TSX
6. **Language Model** → `vscode.lm.sendRequest()` to GitHub Copilot API
7. **Response Streaming** → Back to Chat Panel/Inline Chat
8. **Tool Calling** → `vscode.lm.invokeTool()` for tool execution
9. **Conversation Store** → Persists conversation history

### Key Files to Transform
- `src/extension/conversation/vscode-node/chatParticipants.ts` - Agent registration
- `src/extension/prompt/node/chatParticipantRequestHandler.ts` - Request orchestration
- `src/extension/intents/node/agentIntent.ts` - Agent intent implementation
- `src/extension/prompt/common/conversation.ts` - Conversation data structures
- `src/extension/conversationStore/node/conversationStore.ts` - Conversation persistence

## Transformation Strategy

### 1. ACP Request Handler (New)

Create a new ACP-based request handler that replaces the current flow:

**File**: `src/platform/acp/acp-request-handler.ts`

**Responsibilities**:
- Accept user messages from VS Code Chat Panel
- Map VS Code chat context to ACP session context
- Call `ACPClient.prompt()` with user message
- Handle streaming responses from ACP agent
- Map ACP content blocks to VS Code chat response format
- Handle tool calls and permission requests
- Update VS Code UI with agent plan, thinking steps, etc.

**Key Methods**:
```typescript
class ACPRequestHandler {
  constructor(
    private acpClient: ACPClient,
    private stream: vscode.ChatResponseStream,
    private token: vscode.CancellationToken
  )
  
  async handleRequest(
    message: string,
    references: vscode.ChatPromptReference[]
  ): Promise<ChatResult>
  
  private handleAgentMessage(content: AgentMessageContent): void
  private handleToolCall(toolCall: ToolCall): Promise<void>
  private handlePermissionRequest(request: PermissionRequest): Promise<PermissionResponse>
  private handleAgentPlan(plan: AgentPlan): void
  private handleThinkingStep(thinking: string): void
}
```

### 2. ACP Chat Participant (New)

Create a new chat participant that uses the ACP client:

**File**: `src/extension/conversation/vscode-node/acpChatParticipant.ts`

**Responsibilities**:
- Register a single ACP-based chat participant
- Initialize ACP client with configured agent
- Route all chat requests through `ACPRequestHandler`
- Handle session lifecycle (new/load/cancel)
- Map VS Code chat variables to ACP embedded resources

**Key Methods**:
```typescript
class ACPChatParticipant {
  constructor(
    private agentConfigManager: AgentConfigManager,
    private fileSystemHandler: FileSystemHandler,
    private terminalManager: TerminalManager,
    private permissionHandler: PermissionHandler,
    private mcpManager: MCPManager
  )
  
  async initialize(): Promise<void>
  private createChatHandler(): vscode.ChatRequestHandler
  private handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult>
}
```

### 3. Content Block Mapper (New)

Map ACP content blocks to VS Code chat response format:

**File**: `src/platform/acp/content-block-mapper.ts`

**Responsibilities**:
- Convert ACP `TextContent` to `stream.markdown()`
- Convert ACP `ImageContent` to VS Code image references
- Convert ACP `EmbeddedResourceContent` to VS Code file references
- Handle code blocks with language detection

### 4. Tool Call Handler (New)

Handle ACP tool calls and map to VS Code operations:

**File**: `src/platform/acp/tool-call-handler.ts`

**Responsibilities**:
- Display tool calls in VS Code UI
- Request user permission via `PermissionHandler`
- Execute approved tool calls via `FileSystemHandler` or `TerminalManager`
- Send tool results back to ACP agent
- Handle tool call errors

### 5. Session Manager (New)

Manage ACP sessions and map to VS Code conversations:

**File**: `src/platform/acp/session-manager.ts`

**Responsibilities**:
- Create new ACP sessions for new VS Code conversations
- Load existing ACP sessions for conversation history
- Persist session state to disk (if enabled)
- Handle session cancellation
- Map VS Code conversation IDs to ACP session IDs

**Key Methods**:
```typescript
class SessionManager {
  constructor(
    private acpClient: ACPClient,
    private storageDirectory: string
  )
  
  async createSession(conversationId: string): Promise<string>
  async loadSession(conversationId: string): Promise<string | undefined>
  async cancelSession(sessionId: string): Promise<void>
  async persistSession(sessionId: string, conversationId: string): Promise<void>
  async getSessionHistory(sessionId: string): Promise<SessionHistory>
}
```

### 6. Agent Plan Viewer (New)

Display ACP agent plans in VS Code UI:

**File**: `src/extension/ui/vscode-node/agentPlanViewer.ts`

**Responsibilities**:
- Listen for `agent_plan` notifications from ACP agent
- Display plan steps in VS Code chat response
- Update plan status as agent executes steps
- Show plan completion/failure

**UI Format**:
```
🎯 Agent Plan:
  1. ✓ Read file src/index.ts
  2. ⏳ Analyze code structure
  3. ⏸️ Generate new function
  4. ⏸️ Write changes to file
```

### 7. Thinking Steps Display (New)

Display ACP agent thinking steps in VS Code UI:

**File**: `src/extension/ui/vscode-node/thinkingStepsDisplay.ts`

**Responsibilities**:
- Listen for `thinking` content blocks from ACP agent
- Display thinking steps in collapsible UI element
- Show reasoning process to user

**UI Format**:
```
💭 Agent Thinking (click to expand)
  > Analyzing the user's request...
  > The user wants to add error handling to the function
  > I should check if the function already has try-catch blocks
  > ...
```

### 8. Inline Chat Integration

Transform inline chat to use ACP:

**File**: `src/extension/conversation/vscode-node/acpInlineChatHandler.ts`

**Responsibilities**:
- Handle inline chat requests via ACP
- Apply code edits from ACP agent responses
- Show diff preview for changes
- Handle multi-file edits

### 9. Configuration UI

Add VS Code settings UI for ACP configuration:

**Settings to expose**:
- Agent executable path (with file picker)
- Agent arguments (array input)
- Agent environment variables (key-value pairs)
- Agent profiles (dropdown selector)
- MCP servers (list editor)
- Permission auto-approve settings (checkboxes)
- Session persistence (toggle)

### 10. Extension Activation

Update extension activation to initialize ACP:

**File**: `src/extension/vscode-node/extension.ts`

**Changes**:
- Remove GitHub Copilot API initialization
- Initialize ACP client on activation
- Register ACP chat participant
- Start configured MCP servers
- Load agent profiles

## Testing Strategy

### Unit Tests

1. **ACP Request Handler** (`test/unit/acp/acp-request-handler.spec.ts`)
   - Test message handling
   - Test streaming responses
   - Test tool call handling
   - Test permission requests
   - Test error handling

2. **Content Block Mapper** (`test/unit/acp/content-block-mapper.spec.ts`)
   - Test text content mapping
   - Test image content mapping
   - Test embedded resource mapping
   - Test code block detection

3. **Tool Call Handler** (`test/unit/acp/tool-call-handler.spec.ts`)
   - Test tool call display
   - Test permission flow
   - Test tool execution
   - Test error handling

4. **Session Manager** (`test/unit/acp/session-manager.spec.ts`)
   - Test session creation
   - Test session loading
   - Test session persistence
   - Test session cancellation

### Integration Tests

1. **End-to-End Chat Flow** (`test/integration/acp/chat-flow.spec.ts`)
   - Test complete chat request/response cycle
   - Test multi-turn conversations
   - Test tool calls with permission
   - Test session persistence

2. **Inline Chat Flow** (`test/integration/acp/inline-chat-flow.spec.ts`)
   - Test inline chat requests
   - Test code edits
   - Test diff preview
   - Test multi-file edits

3. **MCP Integration** (`test/integration/acp/mcp-integration-flow.spec.ts`)
   - Test MCP server startup
   - Test MCP tool calls
   - Test MCP server errors

## Migration Path

### Phase 3.1: Core Request Handler (Week 1)
- [ ] Create `ACPRequestHandler`
- [ ] Create `ContentBlockMapper`
- [ ] Create `SessionManager`
- [ ] Write unit tests
- [ ] Write integration tests

### Phase 3.2: Chat Participant (Week 2)
- [ ] Create `ACPChatParticipant`
- [ ] Create `ToolCallHandler`
- [ ] Integrate with existing VS Code chat UI
- [ ] Write unit tests
- [ ] Write integration tests

### Phase 3.3: Agent Plan & Thinking (Week 3)
- [ ] Create `AgentPlanViewer`
- [ ] Create `ThinkingStepsDisplay`
- [ ] Integrate with chat response stream
- [ ] Write unit tests
- [ ] Write integration tests

### Phase 3.4: Inline Chat (Week 4)
- [ ] Create `ACPInlineChatHandler`
- [ ] Integrate with VS Code inline chat
- [ ] Handle code edits and diffs
- [ ] Write unit tests
- [ ] Write integration tests

### Phase 3.5: Configuration UI (Week 5)
- [ ] Add settings to `package.json`
- [ ] Create settings UI components
- [ ] Add agent profile selector
- [ ] Add MCP server configuration
- [ ] Write tests

### Phase 3.6: Extension Activation (Week 6)
- [ ] Update `extension.ts`
- [ ] Remove GitHub Copilot API dependencies
- [ ] Initialize ACP on activation
- [ ] Write activation tests
- [ ] End-to-end testing

## Breaking Changes

1. **No more GitHub Copilot API**: Extension will only work with ACP agents
2. **New configuration**: Users must configure an ACP agent executable
3. **Different tool calling**: Tools are now ACP-based, not VS Code language model tools
4. **Session persistence**: Sessions are now managed by ACP, not VS Code

## Open Questions

1. **Multi-agent support**: Should we support multiple ACP agents simultaneously?
2. **Agent discovery**: Should we auto-discover ACP agents on the system?
3. **Fallback behavior**: What happens if no ACP agent is configured?
4. **Migration tool**: Should we provide a tool to migrate existing conversations?
5. **Telemetry**: How do we handle telemetry without GitHub Copilot API?

## Success Criteria

- [ ] All existing chat functionality works with ACP
- [ ] All existing inline chat functionality works with ACP
- [ ] Agent plans are displayed correctly
- [ ] Thinking steps are displayed correctly
- [ ] Tool calls work with permission flow
- [ ] MCP integration works
- [ ] Session persistence works
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Migration guide is written

## Next Steps

1. Review this plan with the user
2. Start Phase 3.1: Core Request Handler
3. Create TDD tests for `ACPRequestHandler`
4. Implement `ACPRequestHandler`
5. Create TDD tests for `ContentBlockMapper`
6. Implement `ContentBlockMapper`
7. Create TDD tests for `SessionManager`
8. Implement `SessionManager`
9. Run all tests and verify
10. Commit Phase 3.1 progress

# ACP Transformation Specification

## Executive Summary

Transform the GitHub Copilot Chat VS Code extension into a pure **ACP Client** implementation. This will enable the extension to work with any ACP-compliant agent (Claude Code, Goose, Gemini CLI, etc.) instead of being tightly coupled to GitHub Copilot's proprietary API.

---

## High-Level Architecture Changes

### Current Architecture (Copilot-Specific)
```
VS Code Extension
  ↓
GitHub Copilot API (proprietary)
  ↓
OpenAI/Anthropic/Google Models (via GitHub proxy)
```

### New Architecture (ACP-Based)
```
VS Code Extension (ACP Client)
  ↓ JSON-RPC 2.0 over stdio
ACP Agent (user-configurable subprocess)
  ↓
LLM Provider (agent's choice)
  ↓
MCP Servers (optional, for tools/context)
```

---

## Core Transformation Strategy

### Phase 1: ACP Client Core (Foundation)
1. **Remove all GitHub Copilot API dependencies**
   - Remove `@github/copilot` package
   - Remove authentication to GitHub Copilot services
   - Remove telemetry to GitHub
   - Remove proprietary prompt/completion logic

2. **Implement ACP JSON-RPC 2.0 Client**
   - Create `src/platform/acp/` module structure:
     - `common/protocol.ts` - ACP protocol types/interfaces
     - `node/acpClient.ts` - JSON-RPC client over stdio
     - `node/processManager.ts` - Agent subprocess lifecycle
     - `node/sessionManager.ts` - Session state management
     - `vscode/acpService.ts` - VS Code integration layer

3. **Agent Configuration System**
   - User settings for agent executable path
   - Support for multiple agent profiles (Claude Code, Goose, etc.)
   - Agent capability detection and validation
   - Auto-discovery of installed agents

### Phase 2: Protocol Implementation

#### 2.1 Initialization Flow
```typescript
// src/platform/acp/node/acpClient.ts
class ACPClient {
  async initialize(): Promise<AgentCapabilities> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2025-01-21',
      capabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true
        },
        terminal: true
      },
      clientInfo: {
        name: 'vscode-acp-client',
        version: '1.0.0'
      }
    });
    
    return response.capabilities;
  }
}
```

#### 2.2 Session Management
```typescript
// src/platform/acp/node/sessionManager.ts
class SessionManager {
  async createSession(cwd: string, mcpServers: McpServer[]): Promise<string> {
    const response = await this.client.sendRequest('session/new', {
      cwd: Uri.file(cwd).fsPath, // absolute path
      mcpServers: mcpServers
    });
    
    this.sessions.set(response.sessionId, {
      id: response.sessionId,
      cwd: cwd,
      modes: response.modes,
      currentMode: response.modes?.currentMode,
      history: []
    });
    
    return response.sessionId;
  }
  
  async loadSession(sessionId: string, cwd: string): Promise<void> {
    // Requires agent loadSession capability
    await this.client.sendRequest('session/load', {
      sessionId: sessionId,
      cwd: Uri.file(cwd).fsPath,
      mcpServers: this.getMcpServers()
    });
    
    // Agent will replay conversation via session/update notifications
  }
}
```

#### 2.3 Prompt Turn Handling
```typescript
// src/platform/acp/node/promptHandler.ts
class PromptHandler {
  async sendPrompt(
    sessionId: string,
    prompt: ContentBlock[],
    onUpdate: (update: SessionUpdate) => void
  ): Promise<StopReason> {
    // Register notification handler for streaming updates
    this.client.onNotification('session/update', (params) => {
      if (params.sessionId === sessionId) {
        onUpdate(params.sessionUpdate);
      }
    });
    
    // Send prompt request
    const response = await this.client.sendRequest('session/prompt', {
      sessionId: sessionId,
      prompt: prompt
    });
    
    return response.stopReason;
  }
}
```

#### 2.4 Client-Implemented Methods (File System)
```typescript
// src/platform/acp/node/fileSystemHandler.ts
class FileSystemHandler {
  constructor(private client: ACPClient) {
    // Register fs/read_text_file handler
    this.client.onRequest('fs/read_text_file', async (params) => {
      return await this.readTextFile(params);
    });
    
    // Register fs/write_text_file handler
    this.client.onRequest('fs/write_text_file', async (params) => {
      return await this.writeTextFile(params);
    });
  }
  
  private async readTextFile(params: {
    path: string;
    line?: number;
    limit?: number;
  }): Promise<{ content: string }> {
    // Validate path is within workspace
    this.validatePath(params.path);
    
    // Read from VS Code workspace (includes unsaved changes)
    const uri = Uri.file(params.path);
    const document = await workspace.openTextDocument(uri);
    
    let content = document.getText();
    
    // Apply line filtering if requested
    if (params.line !== undefined) {
      const lines = content.split('\n');
      const startLine = params.line - 1; // Convert to 0-based
      const endLine = params.limit 
        ? Math.min(startLine + params.limit, lines.length)
        : lines.length;
      content = lines.slice(startLine, endLine).join('\n');
    }
    
    return { content };
  }
  
  private async writeTextFile(params: {
    path: string;
    content: string;
  }): Promise<void> {
    // Validate path is within workspace
    this.validatePath(params.path);
    
    const uri = Uri.file(params.path);
    const edit = new WorkspaceEdit();
    
    // Check if file exists
    try {
      const document = await workspace.openTextDocument(uri);
      // Replace entire document
      const fullRange = new Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(uri, fullRange, params.content);
    } catch {
      // File doesn't exist, create it
      edit.createFile(uri, { ignoreIfExists: true });
      edit.insert(uri, new Position(0, 0), params.content);
    }
    
    await workspace.applyEdit(edit);
  }
  
  private validatePath(path: string): void {
    // Ensure path is absolute
    if (!path.startsWith('/') && !path.match(/^[A-Z]:\\/)) {
      throw new Error('Path must be absolute');
    }
    
    // Ensure path is within workspace boundaries
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }
    
    const isWithinWorkspace = workspaceFolders.some(folder => 
      path.startsWith(folder.uri.fsPath)
    );
    
    if (!isWithinWorkspace) {
      throw new Error('Path must be within workspace');
    }
  }
}
```

#### 2.5 Client-Implemented Methods (Terminal)
```typescript
// src/platform/acp/node/terminalHandler.ts
class TerminalHandler {
  private terminals = new Map<string, {
    terminal: Terminal;
    process: ChildProcess;
    output: string;
    exitCode: number | null;
  }>();
  
  constructor(private client: ACPClient) {
    this.client.onRequest('terminal/create', async (params) => {
      return await this.createTerminal(params);
    });
    
    this.client.onRequest('terminal/output', async (params) => {
      return await this.getOutput(params);
    });
    
    this.client.onRequest('terminal/wait_for_exit', async (params) => {
      return await this.waitForExit(params);
    });
    
    this.client.onRequest('terminal/kill', async (params) => {
      return await this.killTerminal(params);
    });
    
    this.client.onRequest('terminal/release', async (params) => {
      return await this.releaseTerminal(params);
    });
  }
  
  private async createTerminal(params: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    outputByteLimit?: number;
  }): Promise<{ terminalId: string }> {
    const terminalId = randomUUID();
    
    // Spawn process
    const process = spawn(params.command, params.args || [], {
      cwd: params.cwd,
      env: { ...process.env, ...params.env },
      shell: true
    });
    
    let output = '';
    const byteLimit = params.outputByteLimit || 1024 * 1024; // 1MB default
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length <= byteLimit) {
        output += chunk;
      }
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (output.length + chunk.length <= byteLimit) {
        output += chunk;
      }
    });
    
    let exitCode: number | null = null;
    process.on('exit', (code) => {
      exitCode = code;
    });
    
    // Create VS Code terminal for visualization
    const terminal = window.createTerminal({
      name: `ACP: ${params.command}`,
      shellPath: params.command,
      shellArgs: params.args,
      cwd: params.cwd,
      env: params.env
    });
    
    this.terminals.set(terminalId, {
      terminal,
      process,
      output,
      exitCode
    });
    
    return { terminalId };
  }
  
  private async getOutput(params: {
    terminalId: string;
  }): Promise<{ output: string; exitCode: number | null }> {
    const terminal = this.terminals.get(params.terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${params.terminalId} not found`);
    }
    
    return {
      output: terminal.output,
      exitCode: terminal.exitCode
    };
  }
  
  private async waitForExit(params: {
    terminalId: string;
  }): Promise<{ exitCode: number }> {
    const terminal = this.terminals.get(params.terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${params.terminalId} not found`);
    }
    
    // Wait for process to exit
    return new Promise((resolve) => {
      if (terminal.exitCode !== null) {
        resolve({ exitCode: terminal.exitCode });
      } else {
        terminal.process.on('exit', (code) => {
          resolve({ exitCode: code || 0 });
        });
      }
    });
  }
  
  private async killTerminal(params: {
    terminalId: string;
  }): Promise<void> {
    const terminal = this.terminals.get(params.terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${params.terminalId} not found`);
    }
    
    terminal.process.kill('SIGTERM');
  }
  
  private async releaseTerminal(params: {
    terminalId: string;
  }): Promise<void> {
    const terminal = this.terminals.get(params.terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${params.terminalId} not found`);
    }
    
    // Kill if still running
    if (terminal.exitCode === null) {
      terminal.process.kill('SIGTERM');
    }
    
    // Dispose VS Code terminal
    terminal.terminal.dispose();
    
    // Remove from map
    this.terminals.delete(params.terminalId);
  }
}
```

#### 2.6 Permission Request Handler
```typescript
// src/platform/acp/vscode/permissionHandler.ts
class PermissionHandler {
  constructor(private client: ACPClient) {
    this.client.onRequest('session/request_permission', async (params) => {
      return await this.requestPermission(params);
    });
  }
  
  private async requestPermission(params: {
    sessionId: string;
    toolCallId: string;
    title: string;
    description?: string;
    options: PermissionOption[];
  }): Promise<{ option: PermissionOption | 'cancelled' }> {
    // Show VS Code quick pick
    const items = params.options.map(option => ({
      label: this.getOptionLabel(option),
      description: this.getOptionDescription(option),
      option: option
    }));
    
    const selected = await window.showQuickPick(items, {
      placeHolder: params.title,
      title: params.description
    });
    
    if (!selected) {
      return { option: 'cancelled' };
    }
    
    // Store "always" preferences
    if (selected.option === 'allow_always' || selected.option === 'reject_always') {
      await this.storePermissionPreference(params.toolCallId, selected.option);
    }
    
    return { option: selected.option };
  }
  
  private getOptionLabel(option: PermissionOption): string {
    switch (option) {
      case 'allow_once': return '✓ Allow Once';
      case 'allow_always': return '✓✓ Always Allow';
      case 'reject_once': return '✗ Reject Once';
      case 'reject_always': return '✗✗ Always Reject';
    }
  }
  
  private getOptionDescription(option: PermissionOption): string {
    switch (option) {
      case 'allow_once': return 'Allow this action for this request only';
      case 'allow_always': return 'Always allow this type of action';
      case 'reject_once': return 'Reject this action for this request only';
      case 'reject_always': return 'Always reject this type of action';
    }
  }
  
  private async storePermissionPreference(
    toolCallId: string,
    option: 'allow_always' | 'reject_always'
  ): Promise<void> {
    // Store in workspace state or global state
    const config = workspace.getConfiguration('acp');
    const permissions = config.get<Record<string, string>>('permissions', {});
    permissions[toolCallId] = option;
    await config.update('permissions', permissions, ConfigurationTarget.Global);
  }
}
```

### Phase 3: VS Code UI Integration

#### 3.1 Chat Panel Transformation
```typescript
// src/extension/chat/vscode/acpChatPanel.ts
class ACPChatPanel {
  private sessionId: string | null = null;
  private messageHistory: ChatMessage[] = [];
  
  async sendMessage(text: string, attachments: Uri[] = []): Promise<void> {
    // Ensure session exists
    if (!this.sessionId) {
      const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        throw new Error('No workspace folder open');
      }
      this.sessionId = await this.sessionManager.createSession(cwd, this.getMcpServers());
    }
    
    // Build prompt content blocks
    const prompt: ContentBlock[] = [
      { type: 'text', text: text }
    ];
    
    // Add attachments as embedded resources
    for (const uri of attachments) {
      const document = await workspace.openTextDocument(uri);
      prompt.push({
        type: 'embedded_resource',
        resource: {
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: document.getText()
        }
      });
    }
    
    // Add user message to UI
    this.addMessage({
      role: 'user',
      content: prompt
    });
    
    // Send prompt and handle streaming updates
    const stopReason = await this.promptHandler.sendPrompt(
      this.sessionId,
      prompt,
      (update) => this.handleSessionUpdate(update)
    );
    
    // Handle stop reason
    if (stopReason === 'cancelled') {
      this.showStatus('Cancelled by user');
    } else if (stopReason === 'max_tokens') {
      this.showStatus('Response truncated (max tokens reached)');
    }
  }
  
  private handleSessionUpdate(update: SessionUpdate): void {
    switch (update.type) {
      case 'user_message_chunk':
        // Echo user message (usually just confirmation)
        break;
        
      case 'agent_message_chunk':
        // Stream agent response to UI
        this.appendToLastMessage(update.content);
        break;
        
      case 'agent_thought_chunk':
        // Show internal reasoning (optional, can be collapsed)
        this.showThought(update.content);
        break;
        
      case 'tool_call':
        // New tool call initiated
        this.addToolCall(update.toolCall);
        break;
        
      case 'tool_call_update':
        // Update existing tool call
        this.updateToolCall(update.toolCallId, update.updates);
        break;
        
      case 'plan':
        // Show/update agent plan
        this.updatePlan(update.plan);
        break;
        
      case 'available_commands_update':
        // Update available slash commands
        this.updateAvailableCommands(update.commands);
        break;
        
      case 'current_mode_update':
        // Update current session mode
        this.updateCurrentMode(update.mode);
        break;
    }
  }
  
  private addToolCall(toolCall: ToolCall): void {
    // Render tool call in UI based on kind
    const element = this.createToolCallElement(toolCall);
    this.chatContainer.appendChild(element);
    
    // Handle different tool call kinds
    switch (toolCall.kind) {
      case 'read':
        this.renderReadToolCall(element, toolCall);
        break;
      case 'edit':
        this.renderEditToolCall(element, toolCall);
        break;
      case 'execute':
        this.renderExecuteToolCall(element, toolCall);
        break;
      case 'think':
        this.renderThinkToolCall(element, toolCall);
        break;
      // ... other kinds
    }
    
    // Handle locations for "follow-along" feature
    if (toolCall.locations && toolCall.locations.length > 0) {
      this.highlightLocations(toolCall.locations);
    }
  }
  
  private renderEditToolCall(element: HTMLElement, toolCall: ToolCall): void {
    // Find diff content
    const diffContent = toolCall.content?.find(c => c.type === 'diff');
    if (diffContent && diffContent.type === 'diff') {
      // Render diff viewer
      const diffViewer = this.createDiffViewer(
        diffContent.oldText,
        diffContent.newText,
        diffContent.path
      );
      element.appendChild(diffViewer);
      
      // Add "Apply" button if status is completed
      if (toolCall.status === 'completed') {
        const applyButton = this.createButton('Apply Changes', async () => {
          await this.applyDiff(diffContent);
        });
        element.appendChild(applyButton);
      }
    }
  }
  
  private renderExecuteToolCall(element: HTMLElement, toolCall: ToolCall): void {
    // Find terminal content
    const terminalContent = toolCall.content?.find(c => c.type === 'terminal');
    if (terminalContent && terminalContent.type === 'terminal') {
      // Render terminal output (streaming)
      const terminalViewer = this.createTerminalViewer(terminalContent.terminalId);
      element.appendChild(terminalViewer);
      
      // Poll for output updates if status is in_progress
      if (toolCall.status === 'in_progress') {
        this.pollTerminalOutput(terminalContent.terminalId, terminalViewer);
      }
    }
  }
}
```

#### 3.2 Inline Chat Integration
```typescript
// src/extension/inlineChat/vscode/acpInlineChat.ts
class ACPInlineChat {
  async show(editor: TextEditor, range: Range): Promise<void> {
    // Get selected text as context
    const selectedText = editor.document.getText(range);
    
    // Show inline chat widget
    const widget = await this.createInlineChatWidget(editor, range);
    
    // Handle user input
    widget.onSubmit(async (text: string) => {
      // Build prompt with embedded context
      const prompt: ContentBlock[] = [
        {
          type: 'embedded_resource',
          resource: {
            uri: editor.document.uri.toString(),
            mimeType: 'text/plain',
            text: selectedText
          }
        },
        { type: 'text', text: text }
      ];
      
      // Send to agent
      const sessionId = await this.getOrCreateSession();
      await this.promptHandler.sendPrompt(sessionId, prompt, (update) => {
        if (update.type === 'tool_call' && update.toolCall.kind === 'edit') {
          // Apply edit directly to editor
          this.applyInlineEdit(editor, range, update.toolCall);
        }
      });
    });
  }
}
```

#### 3.3 Agent Plan Viewer
```typescript
// src/extension/chat/vscode/planViewer.ts
class PlanViewer {
  private planEntries: PlanEntry[] = [];
  private treeView: TreeView<PlanEntry>;
  
  updatePlan(plan: PlanEntry[]): void {
    this.planEntries = plan;
    this.treeView.refresh();
  }
  
  private createTreeItem(entry: PlanEntry): TreeItem {
    const item = new TreeItem(entry.content);
    
    // Set icon based on status
    switch (entry.status) {
      case 'pending':
        item.iconPath = new ThemeIcon('circle-outline');
        break;
      case 'in_progress':
        item.iconPath = new ThemeIcon('sync~spin');
        break;
      case 'completed':
        item.iconPath = new ThemeIcon('check');
        break;
    }
    
    // Set color based on priority
    switch (entry.priority) {
      case 'high':
        item.description = '🔴 High Priority';
        break;
      case 'medium':
        item.description = '🟡 Medium Priority';
        break;
      case 'low':
        item.description = '🟢 Low Priority';
        break;
    }
    
    return item;
  }
}
```

#### 3.4 Session Mode Switcher
```typescript
// src/extension/chat/vscode/modeSelector.ts
class ModeSelector {
  private currentMode: string | null = null;
  private availableModes: SessionMode[] = [];
  
  async showModePicker(): Promise<void> {
    const items = this.availableModes.map(mode => ({
      label: mode.name,
      description: mode.description,
      mode: mode
    }));
    
    const selected = await window.showQuickPick(items, {
      placeHolder: 'Select session mode'
    });
    
    if (selected && selected.mode.name !== this.currentMode) {
      await this.sessionManager.setMode(this.sessionId, selected.mode.name);
    }
  }
  
  updateAvailableModes(modes: SessionMode[]): void {
    this.availableModes = modes;
  }
  
  updateCurrentMode(mode: string): void {
    this.currentMode = mode;
    // Update status bar
    this.statusBarItem.text = `$(symbol-method) ${mode}`;
  }
}
```

#### 3.5 Slash Command Support
```typescript
// src/extension/chat/vscode/slashCommands.ts
class SlashCommandProvider {
  private availableCommands: AvailableCommand[] = [];
  
  updateAvailableCommands(commands: AvailableCommand[]): void {
    this.availableCommands = commands;
  }
  
  provideCompletionItems(
    document: TextDocument,
    position: Position
  ): CompletionItem[] {
    const linePrefix = document.lineAt(position).text.substr(0, position.character);
    
    // Only provide completions if line starts with /
    if (!linePrefix.startsWith('/')) {
      return [];
    }
    
    return this.availableCommands.map(cmd => {
      const item = new CompletionItem(cmd.name, CompletionItemKind.Function);
      item.detail = cmd.description;
      item.insertText = cmd.name;
      
      if (cmd.input?.hint) {
        item.documentation = new MarkdownString(cmd.input.hint);
      }
      
      return item;
    });
  }
}
```

### Phase 4: Configuration & Settings

#### 4.1 Extension Settings
```json
// package.json contributions
{
  "contributes": {
    "configuration": {
      "title": "ACP Client",
      "properties": {
        "acp.agent.executable": {
          "type": "string",
          "default": "",
          "description": "Path to ACP agent executable (e.g., /usr/local/bin/goose, claude-code)"
        },
        "acp.agent.args": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "Additional arguments to pass to agent"
        },
        "acp.agent.env": {
          "type": "object",
          "default": {},
          "description": "Environment variables for agent process"
        },
        "acp.agent.profiles": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "executable": { "type": "string" },
              "args": { "type": "array" },
              "env": { "type": "object" }
            }
          },
          "default": [
            {
              "name": "Goose",
              "executable": "goose",
              "args": ["session", "start"],
              "env": {}
            },
            {
              "name": "Claude Code",
              "executable": "claude-code",
              "args": [],
              "env": {}
            }
          ],
          "description": "Predefined agent profiles"
        },
        "acp.mcp.servers": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "transport": { 
                "type": "string",
                "enum": ["stdio", "http", "sse"]
              },
              "command": { "type": "string" },
              "args": { "type": "array" },
              "env": { "type": "object" },
              "url": { "type": "string" }
            }
          },
          "default": [],
          "description": "MCP servers to make available to agents"
        },
        "acp.permissions.autoAllow": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "Tool call patterns to automatically allow"
        },
        "acp.permissions.autoReject": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "Tool call patterns to automatically reject"
        },
        "acp.ui.showPlan": {
          "type": "boolean",
          "default": true,
          "description": "Show agent plan in sidebar"
        },
        "acp.ui.showThoughts": {
          "type": "boolean",
          "default": false,
          "description": "Show agent internal thoughts in chat"
        },
        "acp.ui.followAlong": {
          "type": "boolean",
          "default": true,
          "description": "Automatically navigate to files being edited by agent"
        },
        "acp.session.persistHistory": {
          "type": "boolean",
          "default": true,
          "description": "Persist session history across VS Code restarts"
        },
        "acp.session.autoResumeLastSession": {
          "type": "boolean",
          "default": true,
          "description": "Automatically resume last session on startup"
        }
      }
    }
  }
}
```

#### 4.2 Agent Profile Selector
```typescript
// src/extension/configuration/vscode/agentProfileSelector.ts
class AgentProfileSelector {
  async selectProfile(): Promise<AgentProfile | null> {
    const config = workspace.getConfiguration('acp');
    const profiles = config.get<AgentProfile[]>('agent.profiles', []);
    
    // Add custom option
    const items = [
      ...profiles.map(p => ({
        label: p.name,
        description: p.executable,
        profile: p
      })),
      {
        label: '$(add) Custom Agent...',
        description: 'Configure a custom agent',
        profile: null
      }
    ];
    
    const selected = await window.showQuickPick(items, {
      placeHolder: 'Select ACP agent'
    });
    
    if (!selected) {
      return null;
    }
    
    if (selected.profile === null) {
      // Custom agent configuration
      return await this.configureCustomAgent();
    }
    
    return selected.profile;
  }
  
  private async configureCustomAgent(): Promise<AgentProfile | null> {
    const executable = await window.showInputBox({
      prompt: 'Enter path to agent executable',
      placeHolder: '/usr/local/bin/my-agent'
    });
    
    if (!executable) {
      return null;
    }
    
    // Validate executable exists
    if (!fs.existsSync(executable)) {
      window.showErrorMessage(`Executable not found: ${executable}`);
      return null;
    }
    
    return {
      name: path.basename(executable),
      executable: executable,
      args: [],
      env: {}
    };
  }
}
```

### Phase 5: MCP Integration

#### 5.1 MCP Server Configuration
```typescript
// src/platform/acp/node/mcpServerManager.ts
class McpServerManager {
  getMcpServers(): McpServer[] {
    const config = workspace.getConfiguration('acp');
    const servers = config.get<any[]>('mcp.servers', []);
    
    return servers.map(server => {
      switch (server.transport) {
        case 'stdio':
          return {
            name: server.name,
            transport: {
              type: 'stdio',
              command: server.command,
              args: server.args || [],
              env: server.env || {}
            }
          };
        case 'http':
          return {
            name: server.name,
            transport: {
              type: 'http',
              url: server.url
            }
          };
        case 'sse':
          return {
            name: server.name,
            transport: {
              type: 'sse',
              url: server.url
            }
          };
        default:
          throw new Error(`Unknown transport: ${server.transport}`);
      }
    });
  }
  
  async addMcpServer(server: McpServer): Promise<void> {
    const config = workspace.getConfiguration('acp');
    const servers = config.get<any[]>('mcp.servers', []);
    servers.push(server);
    await config.update('mcp.servers', servers, ConfigurationTarget.Global);
  }
}
```

#### 5.2 Built-in MCP Server (VS Code Proxy)
```typescript
// src/platform/acp/node/vscodeProxyMcpServer.ts
class VSCodeProxyMcpServer {
  /**
   * Exposes VS Code workspace capabilities as an MCP server
   * that agents can connect to
   */
  async start(): Promise<McpServer> {
    // Start stdio MCP server
    const server = new StdioMcpServer();
    
    // Register tools
    server.registerTool('vscode_search', {
      description: 'Search workspace files',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          includePattern: { type: 'string' },
          excludePattern: { type: 'string' }
        },
        required: ['query']
      }
    }, async (params) => {
      const results = await workspace.findFiles(
        params.includePattern || '**/*',
        params.excludePattern || '**/node_modules/**'
      );
      
      // Search file contents
      const matches = [];
      for (const uri of results) {
        const document = await workspace.openTextDocument(uri);
        const text = document.getText();
        if (text.includes(params.query)) {
          matches.push({
            uri: uri.toString(),
            path: uri.fsPath
          });
        }
      }
      
      return { matches };
    });
    
    server.registerTool('vscode_get_diagnostics', {
      description: 'Get diagnostics (errors/warnings) for files',
      inputSchema: {
        type: 'object',
        properties: {
          uri: { type: 'string' }
        }
      }
    }, async (params) => {
      const uri = params.uri ? Uri.parse(params.uri) : undefined;
      const diagnostics = languages.getDiagnostics(uri);
      
      return {
        diagnostics: diagnostics.map(([uri, diags]) => ({
          uri: uri.toString(),
          diagnostics: diags.map(d => ({
            message: d.message,
            severity: d.severity,
            range: {
              start: { line: d.range.start.line, character: d.range.start.character },
              end: { line: d.range.end.line, character: d.range.end.character }
            }
          }))
        }))
      };
    });
    
    // Register resources
    server.registerResource('workspace_files', {
      description: 'List all workspace files',
      mimeType: 'application/json'
    }, async () => {
      const files = await workspace.findFiles('**/*', '**/node_modules/**');
      return {
        contents: [{
          uri: 'workspace://files',
          mimeType: 'application/json',
          text: JSON.stringify(files.map(f => f.fsPath))
        }]
      };
    });
    
    return {
      name: 'vscode-workspace',
      transport: {
        type: 'stdio',
        command: server.getCommand(),
        args: server.getArgs(),
        env: {}
      }
    };
  }
}
```

### Phase 6: Session Persistence

#### 6.1 Session Storage
```typescript
// src/platform/acp/node/sessionStorage.ts
class SessionStorage {
  private storageUri: Uri;
  
  constructor(context: ExtensionContext) {
    this.storageUri = Uri.joinPath(context.globalStorageUri, 'sessions');
  }
  
  async saveSession(session: {
    id: string;
    cwd: string;
    history: ChatMessage[];
    modes?: { availableModes: SessionMode[]; currentMode: string };
  }): Promise<void> {
    const sessionFile = Uri.joinPath(this.storageUri, `${session.id}.json`);
    await workspace.fs.writeFile(
      sessionFile,
      Buffer.from(JSON.stringify(session, null, 2))
    );
  }
  
  async loadSession(sessionId: string): Promise<any | null> {
    const sessionFile = Uri.joinPath(this.storageUri, `${sessionId}.json`);
    
    try {
      const content = await workspace.fs.readFile(sessionFile);
      return JSON.parse(content.toString());
    } catch {
      return null;
    }
  }
  
  async listSessions(): Promise<string[]> {
    try {
      const entries = await workspace.fs.readDirectory(this.storageUri);
      return entries
        .filter(([name, type]) => type === FileType.File && name.endsWith('.json'))
        .map(([name]) => name.replace('.json', ''));
    } catch {
      return [];
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const sessionFile = Uri.joinPath(this.storageUri, `${sessionId}.json`);
    await workspace.fs.delete(sessionFile);
  }
}
```

### Phase 7: Testing Strategy

#### 7.1 Mock ACP Agent for Testing
```typescript
// test/acp/mockAgent.ts
class MockACPAgent {
  private process: ChildProcess;
  
  start(): void {
    // Start a simple stdio JSON-RPC server
    this.process = spawn('node', [path.join(__dirname, 'mockAgentServer.js')]);
  }
  
  stop(): void {
    this.process.kill();
  }
}

// test/acp/mockAgentServer.js
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const request = JSON.parse(line);
  
  switch (request.method) {
    case 'initialize':
      respond(request.id, {
        protocolVersion: '2025-01-21',
        capabilities: {
          loadSession: true,
          promptCapabilities: {
            image: true,
            audio: false,
            embeddedContext: true
          },
          mcpCapabilities: {
            http: false,
            sse: false
          }
        }
      });
      break;
      
    case 'session/new':
      respond(request.id, {
        sessionId: 'mock-session-123',
        modes: {
          availableModes: [
            { name: 'Ask', description: 'Ask questions' },
            { name: 'Code', description: 'Write code' }
          ],
          currentMode: 'Ask'
        }
      });
      break;
      
    case 'session/prompt':
      // Send some mock updates
      notify('session/update', {
        sessionId: request.params.sessionId,
        sessionUpdate: {
          type: 'agent_message_chunk',
          content: 'Hello! This is a mock response.'
        }
      });
      
      // Respond with stop reason
      setTimeout(() => {
        respond(request.id, {
          stopReason: 'end_turn'
        });
      }, 100);
      break;
  }
});

function respond(id, result) {
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
}

function notify(method, params) {
  console.log(JSON.stringify({ jsonrpc: '2.0', method, params }));
}
```

#### 7.2 Integration Tests
```typescript
// test/acp/integration.test.ts
describe('ACP Integration', () => {
  let mockAgent: MockACPAgent;
  let acpClient: ACPClient;
  
  beforeEach(async () => {
    mockAgent = new MockACPAgent();
    mockAgent.start();
    
    acpClient = new ACPClient({
      executable: 'node',
      args: [path.join(__dirname, 'mockAgentServer.js')]
    });
    
    await acpClient.start();
  });
  
  afterEach(async () => {
    await acpClient.stop();
    mockAgent.stop();
  });
  
  it('should initialize agent', async () => {
    const capabilities = await acpClient.initialize();
    expect(capabilities.loadSession).toBe(true);
    expect(capabilities.promptCapabilities.image).toBe(true);
  });
  
  it('should create session', async () => {
    await acpClient.initialize();
    const sessionId = await acpClient.createSession('/workspace', []);
    expect(sessionId).toBe('mock-session-123');
  });
  
  it('should send prompt and receive response', async () => {
    await acpClient.initialize();
    const sessionId = await acpClient.createSession('/workspace', []);
    
    const updates: SessionUpdate[] = [];
    const stopReason = await acpClient.sendPrompt(
      sessionId,
      [{ type: 'text', text: 'Hello' }],
      (update) => updates.push(update)
    );
    
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].type).toBe('agent_message_chunk');
    expect(stopReason).toBe('end_turn');
  });
});
```

---

## Migration Path

### Breaking Changes
1. **Remove all GitHub Copilot dependencies**
   - No backward compatibility with GitHub Copilot API
   - Users must configure an ACP-compliant agent

2. **New configuration required**
   - Users must set `acp.agent.executable` or select an agent profile
   - Optional MCP server configuration

3. **Different UX patterns**
   - Tool calls are more explicit (permission requests)
   - Agent plans are visible
   - Session modes replace chat modes

### Migration Steps for Users
1. Install an ACP-compliant agent (Goose, Claude Code, etc.)
2. Configure agent in VS Code settings
3. Optionally configure MCP servers for additional capabilities
4. Start chatting!

---

## File Structure Changes

### Remove
```
src/extension/
  ├── completions/          # GitHub Copilot completions
  ├── agents/               # GitHub Copilot agents
  └── authentication/       # GitHub authentication
```

### Add
```
src/platform/acp/
  ├── common/
  │   ├── protocol.ts       # ACP protocol types
  │   └── types.ts          # Shared types
  ├── node/
  │   ├── acpClient.ts      # JSON-RPC client
  │   ├── processManager.ts # Agent subprocess
  │   ├── sessionManager.ts # Session state
  │   ├── fileSystemHandler.ts
  │   ├── terminalHandler.ts
  │   ├── mcpServerManager.ts
  │   └── sessionStorage.ts
  └── vscode/
      ├── acpService.ts     # Main service
      ├── permissionHandler.ts
      └── agentProfileSelector.ts

src/extension/chat/
  └── vscode/
      ├── acpChatPanel.ts   # ACP-based chat UI
      ├── planViewer.ts     # Agent plan viewer
      ├── modeSelector.ts   # Session mode switcher
      └── slashCommands.ts  # Slash command support

src/extension/inlineChat/
  └── vscode/
      └── acpInlineChat.ts  # ACP-based inline chat
```

---

## Timeline Estimate

### Phase 1: Foundation (2-3 weeks)
- Remove GitHub Copilot dependencies
- Implement ACP JSON-RPC client
- Basic agent subprocess management
- Configuration system

### Phase 2: Protocol Implementation (3-4 weeks)
- Initialization flow
- Session management
- Prompt turn handling
- File system methods
- Terminal methods
- Permission requests

### Phase 3: UI Integration (3-4 weeks)
- Chat panel transformation
- Inline chat integration
- Plan viewer
- Mode selector
- Slash command support
- Tool call rendering

### Phase 4: MCP & Advanced Features (2-3 weeks)
- MCP server configuration
- VS Code proxy MCP server
- Session persistence
- Agent profile management

### Phase 5: Testing & Polish (2-3 weeks)
- Mock agent for testing
- Integration tests
- Documentation
- Example configurations

**Total: 12-17 weeks**

---

## Success Metrics

1. **Agent Compatibility**
   - Works with Goose, Claude Code, Gemini CLI, etc.
   - Graceful degradation for missing capabilities

2. **Performance**
   - Agent startup < 2 seconds
   - Prompt response latency < 500ms
   - Smooth streaming updates

3. **UX Quality**
   - Clear tool call visualization
   - Intuitive permission requests
   - Helpful error messages

4. **Reliability**
   - Handles agent crashes gracefully
   - Session recovery works
   - No data loss

---

## Open Questions

1. **A2A Transition**: Should we plan for A2A migration now, or wait for spec stabilization?
2. **Web Worker Support**: Can we support ACP in web extension host? (stdio over WebSocket?)
3. **Multi-Agent**: Should we support multiple agents simultaneously?
4. **Agent Discovery**: Auto-detect installed agents on system?
5. **Telemetry**: What telemetry (if any) should we collect?

---

## Next Steps

1. **Validate Approach**: Review this spec with stakeholders
2. **Prototype**: Build minimal ACP client + mock agent
3. **Test with Real Agent**: Integrate with Goose or Claude Code
4. **Iterate**: Refine based on real-world usage
5. **Document**: Create comprehensive user and developer docs

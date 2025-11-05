/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * ACP Protocol Types
 * Based on Agent Client Protocol specification
 */

// ============================================================================
// Core Protocol Types
// ============================================================================

export interface ClientInfo {
    name: string;
    version: string;
}

export interface AgentInfo {
    name: string;
    version: string;
}

// ============================================================================
// Capabilities
// ============================================================================

export interface ClientCapabilities {
    fs?: {
        readTextFile?: boolean;
        writeTextFile?: boolean;
    };
    terminal?: {
        create?: boolean;
        output?: boolean;
        waitForExit?: boolean;
        kill?: boolean;
        release?: boolean;
    };
}

export interface PromptCapabilities {
    image?: boolean;
    audio?: boolean;
    embeddedContext?: boolean;
}

export interface McpCapabilities {
    http?: boolean;
    sse?: boolean;
}

export interface AgentCapabilities {
    loadSession?: boolean;
    setMode?: boolean;
    promptCapabilities?: PromptCapabilities;
    mcpCapabilities?: McpCapabilities;
    availableModes?: string[];
    availableCommands?: string[];
}

// ============================================================================
// Initialization
// ============================================================================

export interface InitializeParams {
    protocolVersion: string;
    clientCapabilities: ClientCapabilities;
    clientInfo: ClientInfo;
}

export interface InitializeResult {
    protocolVersion: string;
    agentCapabilities: AgentCapabilities;
    agentInfo?: AgentInfo;
}

// ============================================================================
// Session Management
// ============================================================================

export interface McpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface SessionNewParams {
    cwd: string;
    mcpServers?: McpServerConfig[];
}

export interface SessionNewResult {
    sessionId: string;
}

export interface SessionLoadParams {
    sessionId: string;
}

export interface SessionLoadResult {
    // Empty object on success
}

export interface SessionSetModeParams {
    sessionId: string;
    mode: string;
}

export interface SessionSetModeResult {
    // Empty object on success
}

// ============================================================================
// Content Blocks (reusing MCP types where possible)
// ============================================================================

export type ContentBlock = 
    | TextContent
    | ImageContent
    | AudioContent
    | EmbeddedResourceContent
    | ResourceLinkContent
    | ThinkingContent;

export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    data: string; // base64 encoded
    mimeType: string;
}

export interface AudioContent {
    type: 'audio';
    data: string; // base64 encoded
    mimeType: string;
}

export interface EmbeddedResourceContent {
    type: 'embedded_resource';
    resource: {
        type?: 'file' | 'text';
        uri: string;
        mimeType?: string;
        text?: string;
    };
}

export interface ResourceLinkContent {
    type: 'resource_link';
    uri: string;
}

/**
 * Thinking content block from agent
 * Represents a single thinking step in the agent's reasoning process
 */
export interface ThinkingContent {
    type: 'thinking';
    thinking: string;
}

// ============================================================================
// Prompt Turn
// ============================================================================

export interface SessionPromptParams {
    sessionId?: string;
    prompt?: ContentBlock[];
    messages?: Array<{
        role: 'user' | 'assistant';
        content: ContentBlock[];
    }>;
}

export type StopReason = 
    | 'end_turn'
    | 'max_tokens'
    | 'cancelled'
    | 'error';

export interface SessionPromptResult {
    stopReason: StopReason;
}

// ============================================================================
// Tool Calls
// ============================================================================

export enum ToolCallKind {
    // File system operations
    ReadTextFile = 'fs/read_text_file',
    WriteTextFile = 'fs/write_text_file',
    Read = 'read', // Simplified alias for read operations
    Write = 'write', // Simplified alias for write operations
    
    // Terminal operations
    TerminalCreate = 'terminal/create',
    TerminalSendInput = 'terminal/send_input',
    TerminalSendText = 'terminal/send_text', // Alias for send_input
    TerminalGetOutput = 'terminal/get_output',
    TerminalKill = 'terminal/kill',
    Execute = 'execute', // Simplified alias for execute operations
    
    // MCP operations
    MCPToolCall = 'mcp/tool_call',
}

export enum ToolCallStatus {
    Pending = 'pending',
    InProgress = 'in_progress',
    Completed = 'completed',
    Error = 'error',
    AwaitingPermission = 'awaiting_permission',
}

export interface ToolCallLocation {
    path: string;
    range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
}

export interface ToolCallContent {
    type: 'text' | 'diff' | 'terminal';
    content: string;
    terminalId?: string;
}

export interface ToolCall {
    toolCallId: string;
    id: string; // Alias for toolCallId for compatibility
    title: string;
    kind: ToolCallKind;
    status: ToolCallStatus;
    content?: ToolCallContent | string;
    input?: Record<string, any>; // Tool input parameters
    locations?: ToolCallLocation[];
    error?: string; // Error message if status is 'error'
}

export interface ToolResult {
    toolCallId: string;
    content: ContentBlock[];
    error?: string;
}

// ============================================================================
// Session Updates (Notifications from Agent)
// ============================================================================

export type SessionUpdateNotification = 
    | AgentMessageChunkUpdate
    | ToolCallUpdate
    | ToolCallUpdateStatus
    | PlanUpdate;

export interface AgentMessageChunkUpdate {
    sessionId: string;
    sessionUpdate: 'agent_message_chunk';
    content: string;
}

export interface ToolCallUpdate {
    sessionId: string;
    sessionUpdate: 'tool_call';
    toolCallId: string;
    title: string;
    kind: ToolCallKind;
    status: ToolCallStatus;
    content?: ToolCallContent | string;
    locations?: ToolCallLocation[];
}

export interface ToolCallUpdateStatus {
    sessionId: string;
    sessionUpdate: 'tool_call_update';
    toolCallId: string;
    status: ToolCallStatus;
    content?: ToolCallContent | string;
    locations?: ToolCallLocation[];
}

export interface PlanEntry {
    content: string;
    priority?: 'high' | 'medium' | 'low';
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PlanUpdate {
    sessionId: string;
    sessionUpdate: 'plan';
    plan: PlanEntry[];
    // Optional properties for single-step updates
    description?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Agent Plan notification structure
 * Used for displaying agent's execution plan in the UI
 */
export interface AgentPlan {
    steps: Array<{
        description: string;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }>;
}

/**
 * Session mode definition
 * Represents a mode that the agent can operate in (e.g., "chat", "code", "debug")
 */
export interface SessionMode {
    name: string;
    description: string;
    icon?: string;
}

/**
 * Session modes configuration
 * Contains available modes and the currently active mode
 */
export interface SessionModes {
    availableModes: SessionMode[];
    currentMode: string;
}

// ============================================================================
// Slash Commands
// ============================================================================

/**
 * Represents a slash command that can be invoked in the chat interface
 */
export interface SlashCommand {
    /** Command name (without the leading /) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Optional input configuration */
    input?: {
        /** Hint text for the input */
        hint?: string;
        /** Whether input is required */
        required?: boolean;
    };
}

/**
 * Notification from agent about available slash commands
 */
export interface AvailableCommandsUpdate {
    type: 'available_commands_update';
    commands: SlashCommand[];
}

// ============================================================================
// Session Cancellation
// ============================================================================

export interface SessionCancelParams {
    sessionId: string;
}

// ============================================================================
// Permission Requests (from Agent to Client)
// ============================================================================

export type PermissionDecision = 
    | 'allow_once'
    | 'allow_always'
    | 'reject_once'
    | 'reject_always';

export interface SessionRequestPermissionParams {
    id?: string; // Optional request ID
    sessionId: string;
    toolCallId: string;
    title: string;
    kind: ToolCallKind;
    content?: string;
    locations?: ToolCallLocation[];
}

export interface SessionRequestPermissionResult {
    id?: string; // Optional response ID (matches request ID)
    decision: PermissionDecision;
}

// ============================================================================
// File System (Client-Implemented Methods)
// ============================================================================

export interface FsReadTextFileParams {
    path: string;
}

export interface FsReadTextFileResult {
    content: string;
    encoding?: string;
}

export interface FsWriteTextFileParams {
    path: string;
    content: string;
    encoding?: string;
}

export interface FsWriteTextFileResult {
    // Empty object on success
}

// ============================================================================
// Terminal (Client-Implemented Methods)
// ============================================================================

export interface TerminalCreateParams {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
}

export interface TerminalCreateResult {
    terminalId: string;
}

export interface TerminalOutputParams {
    terminalId: string;
}

export interface TerminalOutputResult {
    output: string;
}

export interface TerminalWaitForExitParams {
    terminalId: string;
    timeout?: number;
}

export interface TerminalWaitForExitResult {
    exitCode: number;
}

export interface TerminalKillParams {
    terminalId: string;
}

export interface TerminalKillResult {
    // Empty object on success
}

export interface TerminalReleaseParams {
    terminalId: string;
}

export interface TerminalReleaseResult {
    // Empty object on success
}

// ============================================================================
// Type Aliases for Convenience
// ============================================================================

/**
 * Agent message content - alias for ContentBlock
 */
export type AgentMessageContent = ContentBlock;

/**
 * Permission request - alias for SessionRequestPermissionParams
 */
export type PermissionRequest = SessionRequestPermissionParams;

/**
 * Permission response - alias for SessionRequestPermissionResult
 */
export type PermissionResponse = SessionRequestPermissionResult;

/**
 * Prompt request - alias for SessionPromptParams
 */
export type PromptRequest = SessionPromptParams;

/**
 * Session info - alias for SessionNewResult
 */
export type SessionInfo = SessionNewResult;

/**
 * Permission policy configuration
 */
export interface PermissionPolicy {
  pattern: string;
  action: 'allow' | 'deny' | 'prompt';
  description?: string;
}

/**
 * Agent profile configuration
 */
export interface AgentProfile {
    id?: string; // Optional - can be auto-generated
    name: string;
    description?: string;
    command?: string; // Optional - can use executable instead
    executable?: string; // Alternative to command
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
}

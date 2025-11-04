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
    | ResourceLinkContent;

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
        uri: string;
        mimeType?: string;
        text?: string;
    };
}

export interface ResourceLinkContent {
    type: 'resource_link';
    uri: string;
}

// ============================================================================
// Prompt Turn
// ============================================================================

export interface SessionPromptParams {
    sessionId: string;
    prompt: ContentBlock[];
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

export type ToolCallKind = 'read' | 'edit' | 'execute' | 'think';

export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

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
    title: string;
    kind: ToolCallKind;
    status: ToolCallStatus;
    content?: ToolCallContent | string;
    locations?: ToolCallLocation[];
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
    sessionId: string;
    toolCallId: string;
    title: string;
    kind: ToolCallKind;
    content?: string;
    locations?: ToolCallLocation[];
}

export interface SessionRequestPermissionResult {
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

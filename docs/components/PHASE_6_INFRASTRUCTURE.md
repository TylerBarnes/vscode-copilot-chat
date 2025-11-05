# Phase 6: Infrastructure Analysis

**Status:** ✅ Complete  
**Date:** 2025-01-XX  
**Scope:** Core platform infrastructure components in `src/platform/`

---

## Executive Summary

This document analyzes the core infrastructure components that provide foundational services to the extension. These components range from highly reusable utilities (filesystem, workspace, terminal) to deeply Copilot-specific services (embeddings, remote code search, GitHub integration).

### Key Findings

1. **Reusable Infrastructure (Keep):** Many core services are well-designed and ACP-compatible
2. **Copilot-Specific Infrastructure (Remove):** Several services are tightly coupled to GitHub Copilot's proprietary systems
3. **Mixed Infrastructure (Replace/Adapt):** Some services need modification to remove Copilot dependencies

---

## Component Analysis

### 1. Core Workspace & File System Services

#### 1.1 Workspace Service (`src/platform/workspace/`)

**Purpose:** Provides unified interface for workspace operations (documents, folders, edits)

**Key Interfaces:**
- `IWorkspaceService`: Text/notebook documents, workspace folders, file operations
- Events: `onDidOpenTextDocument`, `onDidChangeTextDocument`, etc.
- Methods: `openTextDocument`, `showTextDocument`, `applyEdit`, `getWorkspaceFolders`

**Dependencies:**
- `vscode` API (workspace, window, Uri, TextDocument, NotebookDocument)
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Essential for file operations

**Proposed Action:** ✅ **KEEP** - Well-designed, reusable, ACP-compatible

**Rationale:**
- Clean abstraction over VS Code workspace API
- No Copilot-specific dependencies
- Essential for ACP file system operations
- Already used by ACP components

---

#### 1.2 File System Service (`src/platform/filesystem/`)

**Purpose:** File system operations (read, write, delete, watch)

**Key Interfaces:**
- `IFileSystemService`: CRUD operations for files
- `fileSystemServiceReadAsJSON`: Cached JSON file reading

**Dependencies:**
- `vscode.workspace.fs`
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Core file operations

**Proposed Action:** ✅ **KEEP** - Essential infrastructure

**Rationale:**
- Clean abstraction over VS Code file system API
- No Copilot-specific dependencies
- Required for ACP file system handler
- Already integrated with ACP components

---

#### 1.3 Terminal Service (`src/platform/terminal/`)

**Purpose:** Terminal interaction (buffer, commands, shell type)

**Key Interfaces:**
- `ITerminalService`: Terminal buffer, last command, selection, shell type
- `NullTerminalService`: No-op implementation

**Dependencies:**
- `vscode` types
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Required for ACP terminal control

**Proposed Action:** ✅ **KEEP** - Already used by ACP

**Rationale:**
- Clean interface for terminal operations
- No Copilot-specific dependencies
- Already integrated with `ACPTerminalManager`
- Essential for ACP protocol compliance

---

### 2. Search & Discovery Services

#### 2.1 Search Service (`src/platform/search/`)

**Purpose:** File and text search operations

**Key Interfaces:**
- `ISearchService`: `findFiles`, `findTextInFiles`, `findTextInFiles2`
- Uses `vscode.GlobPattern`, `vscode.CancellationToken`

**Dependencies:**
- `vscode.workspace.findFiles`
- Internal utilities

**ACP Relevance:** ✅ **MEDIUM** - Useful for code search

**Proposed Action:** ✅ **KEEP** (with stub for `findFiles2`)

**Rationale:**
- Clean abstraction over VS Code search API
- `findFiles2` uses proposed API (already stubbed in `StubSearchService`)
- Core search functionality is ACP-compatible
- Useful for agent context gathering

---

#### 2.2 Language Features Service (`src/platform/languages/`)

**Purpose:** Language-specific features (definitions, references, symbols, diagnostics)

**Key Interfaces:**
- `ILanguageFeaturesService`: Definitions, implementations, references, symbols, diagnostics
- `NoopLanguageFeaturesService`: No-op implementation

**Dependencies:**
- `vscode.languages` API
- Internal utilities

**ACP Relevance:** ✅ **MEDIUM** - Useful for code navigation

**Proposed Action:** ✅ **KEEP** - Potentially useful for ACP agents

**Rationale:**
- Clean abstraction over VS Code language features
- No Copilot-specific dependencies
- Could be useful for ACP agents to gather code context
- Already has no-op stub for when not needed

---

### 3. Git & Version Control Services

#### 3.1 Git Service (`src/platform/git/`)

**Purpose:** Git repository interaction (context, log, diff, merge base)

**Key Interfaces:**
- `IGitService`: Repository context, events, log, diff, fetch, merge base
- Helper functions: `getGitHubRepoInfoFromContext`, `getOrderedRepoInfosFromContext`

**Dependencies:**
- VS Code Git extension API
- Internal utilities

**ACP Relevance:** ✅ **MEDIUM** - Useful for version control context

**Proposed Action:** ✅ **KEEP** - Useful for ACP agents

**Rationale:**
- Clean abstraction over Git extension API
- No Copilot-specific dependencies (helpers extract GitHub info but are optional)
- Useful for ACP agents to understand repository context
- Can be stubbed if Git extension not available

---

#### 3.2 GitHub Service (`src/platform/github/`)

**Purpose:** GitHub API integration (repositories, Octokit)

**Key Interfaces:**
- `IGithubRepositoryService`: GitHub repository operations
- `IOctoKitService`: Octokit session management
- `VSCodeTeamId`, `GithubRepositoryItem`, `JobInfo`

**Dependencies:**
- `@octokit/types`
- `ICAPIClientService`
- `ILogService`, `IFetcherService`, `ITelemetryService`
- `githubAPI`

**ACP Relevance:** ❌ **LOW** - GitHub Copilot-specific

**Proposed Action:** ❌ **REMOVE** - Copilot-specific integration

**Rationale:**
- Tightly coupled to GitHub Copilot's backend
- Uses Copilot API client (`ICAPIClientService`)
- Not relevant for generic ACP agents
- Can be removed entirely

---

### 4. Embeddings & Search Infrastructure

#### 4.1 Embeddings Service (`src/platform/embeddings/`)

**Purpose:** Compute and manage embeddings for code search

**Key Interfaces:**
- `IEmbeddingsComputer`: Compute embeddings
- `EmbeddingType`, `EmbeddingVector`, `Embeddings`, `EmbeddingDistance`
- `LEGACY_EMBEDDING_MODEL_ID`

**Dependencies:**
- `TelemetryCorrelationId`
- Internal utilities

**ACP Relevance:** ❌ **LOW** - Copilot-specific embeddings

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's embedding models
- Uses proprietary embedding endpoints
- Not relevant for ACP agents (agents handle their own embeddings)
- Significant complexity with no ACP benefit

---

#### 4.2 Remote Code Search (`src/platform/remoteCodeSearch/`)

**Purpose:** GitHub/ADO remote code search integration

**Key Interfaces:**
- `IGithubCodeSearchService`: GitHub code search
- `RemoteCodeSearchIndexStatus`, `CodeSearchResult`

**Dependencies:**
- Copilot API
- `IAuthenticationService`
- GitHub/ADO authentication

**ACP Relevance:** ❌ **LOW** - Copilot-specific search

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's remote search backend
- Uses proprietary authentication and APIs
- Not relevant for ACP agents
- Can be removed entirely

---

#### 4.3 Chunking Service (`src/platform/chunking/`)

**Purpose:** Code chunking for embeddings and search

**Key Interfaces:**
- `Chunk`, `FileChunk`, `FileChunkAndScore`, `FileChunkWithEmbedding`
- `IChunkingEndpointClient`: Chunking endpoint client

**Dependencies:**
- Copilot chunking endpoint
- Internal utilities

**ACP Relevance:** ❌ **LOW** - Copilot-specific chunking

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's chunking backend
- Uses proprietary chunking algorithms and endpoints
- Not relevant for ACP agents (agents handle their own chunking)
- Can be removed entirely

---

### 5. Networking & Endpoint Services

#### 5.1 Endpoint Provider (`src/platform/endpoint/`)

**Purpose:** Manage chat/completion/embedding endpoints

**Key Interfaces:**
- `IEndpointProvider`: Get all completion models, chat endpoints, embeddings endpoints
- `ModelPolicy`, `CustomModel`, `EndpointEditToolName`
- `IChatModelCapabilities`, `IEmbeddingModelCapabilities`, `ICompletionModelCapabilities`
- `ModelSupportedEndpoint`, `IModelAPIResponse`

**Dependencies:**
- `@vscode/copilot-api`
- `vscode` types

**ACP Relevance:** ❌ **LOW** - Copilot-specific endpoints

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's endpoint system
- Uses proprietary Copilot API types
- Not relevant for ACP agents (agents manage their own models)
- Can be removed entirely

---

#### 5.2 Networking Service (`src/platform/networking/`)

**Purpose:** HTTP fetching and endpoint communication

**Key Interfaces:**
- `IFetcher`: HTTP fetcher interface
- `IEndpoint`, `IEmbeddingsEndpoint`
- `IEndpointBody`: Chat, embeddings, chunking, search, responses APIs
- `IMakeChatRequestOptions`

**Dependencies:**
- `@vscode/copilot-api`
- `@vscode/prompt-tsx`
- `vscode`
- `ICAPIClientService`, `IEndpointProvider`, `ILogService`, `ITelemetryService`, `IFetcherService`

**ACP Relevance:** ❌ **LOW** - Copilot-specific networking

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's networking layer
- Uses proprietary Copilot API types and endpoints
- Not relevant for ACP agents (agents communicate via stdio JSON-RPC)
- Can be removed entirely

---

### 6. UI & Interaction Services

#### 6.1 Dialog Service (`src/platform/dialog/`)

**Purpose:** Show quick picks and open dialogs

**Key Interfaces:**
- `IDialogService`: `showQuickPick`, `showOpenDialog`

**Dependencies:**
- `vscode.window` API

**ACP Relevance:** ✅ **MEDIUM** - Useful for user interaction

**Proposed Action:** ✅ **KEEP** - Useful for ACP UI

**Rationale:**
- Clean abstraction over VS Code dialog API
- No Copilot-specific dependencies
- Useful for ACP configuration and user interaction
- Already used by ACP components

---

#### 6.2 Notification Service (`src/platform/notification/`)

**Purpose:** Show information/warning messages and progress

**Key Interfaces:**
- `INotificationService`: `showInformationMessage`, `showWarningMessage`, `showQuotaExceededDialog`, `withProgress`

**Dependencies:**
- `vscode.window` API
- `vscode.ProgressOptions`, `vscode.CancellationToken`

**ACP Relevance:** ✅ **MEDIUM** - Useful for user feedback

**Proposed Action:** ✅ **KEEP** - Useful for ACP UI

**Rationale:**
- Clean abstraction over VS Code notification API
- No Copilot-specific dependencies (except `showQuotaExceededDialog` which can be removed)
- Useful for ACP agent feedback and progress
- Already used by ACP components

**Modification Required:**
- Remove `showQuotaExceededDialog` (Copilot-specific)

---

#### 6.3 Workbench Service (`src/platform/workbench/`)

**Purpose:** Access extensions, commands, and settings

**Key Interfaces:**
- `IWorkbenchService`: `getAllExtensions`, `getAllCommands`, `getAllSettings`

**Dependencies:**
- `vscode` API
- `SettingListItem` from embeddings (Copilot-specific)

**ACP Relevance:** ✅ **MEDIUM** - Useful for workspace introspection

**Proposed Action:** ✅ **KEEP** (with modification)

**Rationale:**
- Useful for ACP agents to discover workspace capabilities
- Clean abstraction over VS Code workbench API
- Needs to remove dependency on `SettingListItem` from embeddings

**Modification Required:**
- Remove dependency on `src/platform/embeddings/common/vscodeIndex`
- Define `SettingListItem` locally or use simpler type

---

### 7. Editing & Diff Services

#### 7.1 Editing Service (`src/platform/editing/`)

**Purpose:** Text editing utilities and document snapshots

**Key Interfaces:**
- `stringEditFromDiff`: Create text edit from diff
- `stringEditFromTextContentChange`: Create text edit from content change
- `TextDocumentSnapshot`, `NotebookDocumentSnapshot`
- `OffsetLineColumnConverter`, `PositionOffsetTransformer`

**Dependencies:**
- `IDiffService`
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Essential for text editing

**Proposed Action:** ✅ **KEEP** - Essential infrastructure

**Rationale:**
- Clean utilities for text editing operations
- No Copilot-specific dependencies
- Essential for ACP file editing operations
- Well-designed and reusable

---

#### 7.2 Diff Service (`src/platform/diff/`)

**Purpose:** Compute text differences

**Key Interfaces:**
- `IDiffService`: Compute diffs between strings

**Dependencies:**
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Essential for diff operations

**Proposed Action:** ✅ **KEEP** - Essential infrastructure

**Rationale:**
- Clean abstraction for diff computation
- No Copilot-specific dependencies
- Essential for ACP file editing and change tracking
- Well-designed and reusable

---

### 8. Environment & Extensions Services

#### 8.1 Environment Service (`src/platform/env/`)

**Purpose:** Environment information (language, session ID, VS Code version, OS, etc.)

**Key Interfaces:**
- `IEnvService`: Language, session/machine ID, VS Code version, OS, UI kind, extension ID, app root, shell, production/prerelease/simulation status, editor info
- `NullEnvService`: No-op implementation

**Dependencies:**
- `vscode` API
- Internal utilities

**ACP Relevance:** ✅ **HIGH** - Essential for environment context

**Proposed Action:** ✅ **KEEP** - Essential infrastructure

**Rationale:**
- Clean abstraction over VS Code environment API
- No Copilot-specific dependencies (provides generic environment info)
- Essential for ACP agent context
- Already used by ACP components

---

#### 8.2 Extensions Service (`src/platform/extensions/`)

**Purpose:** Query installed extensions

**Key Interfaces:**
- `IExtensionsService`: `getExtension`, `allAcrossExtensionHosts`

**Dependencies:**
- `vscode.extensions` API

**ACP Relevance:** ✅ **MEDIUM** - Useful for workspace context

**Proposed Action:** ✅ **KEEP** - Useful for ACP agents

**Rationale:**
- Clean abstraction over VS Code extensions API
- No Copilot-specific dependencies
- Useful for ACP agents to discover workspace capabilities
- Simple and reusable

---

### 9. Testing & Notebook Services

#### 9.1 Testing Service (`src/platform/testing/`)

**Purpose:** Access test results and failures

**Key Interfaces:**
- `ITestProvider`: `getAllFailures`, `getLastFailureFor`, `hasTestsInUri`
- `NullTestProvider`: No-op implementation

**Dependencies:**
- `vscode` types
- Internal utilities

**ACP Relevance:** ✅ **MEDIUM** - Useful for test context

**Proposed Action:** ✅ **KEEP** - Useful for ACP agents

**Rationale:**
- Clean abstraction over VS Code testing API
- No Copilot-specific dependencies
- Useful for ACP agents to understand test failures
- Already has no-op stub for when not needed

---

#### 9.2 Notebook Service (`src/platform/notebook/`)

**Purpose:** Interact with notebooks (variables, pip packages, cell executions)

**Key Interfaces:**
- `INotebookService`: Get variables, pip packages, cell executions, run cells

**Dependencies:**
- `vscode` notebook API
- Internal utilities

**ACP Relevance:** ❌ **LOW** - Copilot-specific notebook features

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's notebook features
- Not relevant for generic ACP agents
- Can be removed entirely

---

### 10. Specialized Services

#### 10.1 Image Service (`src/platform/image/`)

**Purpose:** Upload image attachments to GitHub Copilot chat

**Key Interfaces:**
- `IImageService`: `uploadChatImageAttachment`
- `nullImageService`: No-op implementation

**Dependencies:**
- GitHub Copilot chat attachments endpoint
- Authentication token

**ACP Relevance:** ❌ **LOW** - Copilot-specific image upload

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's image attachment system
- Uses proprietary endpoints and authentication
- Not relevant for ACP agents (agents handle their own attachments)
- Can be removed entirely

---

#### 10.2 Thinking Service (`src/platform/thinking/`)

**Purpose:** Handle "thinking" data from LLM responses

**Key Interfaces:**
- `ThinkingDataInMessage`: `cot_id`, `cot_summary`, `reasoning_opaque`, `reasoning_text`
- `RawThinkingDelta`: Azure OpenAI, Copilot API, Anthropic fields
- `ThinkingDelta`, `EncryptedThinkingDelta`, `ThinkingData`

**Dependencies:**
- Internal utilities

**ACP Relevance:** ✅ **MEDIUM** - Potentially useful for ACP agents

**Proposed Action:** ⚠️ **ADAPT** - Simplify for ACP

**Rationale:**
- Concept of "thinking" steps is relevant for ACP (agents can send thinking blocks)
- Current implementation is tightly coupled to specific LLM providers (Azure OpenAI, Copilot API, Anthropic)
- Should be simplified to generic "thinking" data structure
- Can be adapted to work with ACP's thinking steps

**Modification Required:**
- Remove provider-specific fields (`cot_id`, `cot_summary`, `reasoning_opaque`, `reasoning_text`)
- Simplify to generic `ThinkingData` structure
- Align with ACP protocol's thinking steps

---

#### 10.3 Review Service (`src/platform/review/`)

**Purpose:** Code review comments and diagnostics

**Key Interfaces:**
- `IReviewService`: Review comments, diagnostics, code feedback
- `ReviewDiagnosticCollection`, `ReviewRanges`, `ReviewRequest`, `ReviewSuggestion`, `ReviewComment`

**Dependencies:**
- `vscode` API
- `TextDocumentSnapshot`

**ACP Relevance:** ❌ **LOW** - Copilot-specific code review

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's code review features
- Uses proprietary review comment system
- Not relevant for generic ACP agents
- Can be removed entirely

---

#### 10.4 Heatmap Service (`src/platform/heatmap/`)

**Purpose:** Track selection points for code heatmap

**Key Interfaces:**
- `IHeatmapService`: `getEntries`
- `SelectionPoint`: Offset and timestamp
- `nullHeatmapService`: No-op implementation

**Dependencies:**
- `vscode.TextDocument`

**ACP Relevance:** ❌ **LOW** - Copilot-specific heatmap

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's heatmap feature
- Not relevant for generic ACP agents
- Can be removed entirely

---

#### 10.5 Ignore Service (`src/platform/ignore/`)

**Purpose:** Content exclusion rules (Copilot ignore files)

**Key Interfaces:**
- `IIgnoreService`: `isCopilotIgnored`, `asMinimatchPattern`
- `NullIgnoreService`: No-op implementation
- `HAS_IGNORED_FILES_MESSAGE`: GitHub Copilot-specific message

**Dependencies:**
- `vscode` API
- Internal utilities

**ACP Relevance:** ❌ **LOW** - Copilot-specific content exclusion

**Proposed Action:** ❌ **REMOVE** - Copilot-specific infrastructure

**Rationale:**
- Tightly coupled to GitHub Copilot's content exclusion system
- Uses proprietary ignore file format
- Not relevant for generic ACP agents
- Can be removed entirely

---

#### 10.6 Scope Selection Service (`src/platform/scopeSelection/`)

**Purpose:** Select enclosing symbol ranges

**Key Interfaces:**
- `IScopeSelector`: `selectEnclosingScope`

**Dependencies:**
- `vscode` API

**ACP Relevance:** ✅ **MEDIUM** - Useful for code selection

**Proposed Action:** ✅ **KEEP** - Useful for ACP agents

**Rationale:**
- Clean abstraction for scope selection
- No Copilot-specific dependencies
- Useful for ACP agents to select code ranges
- Simple and reusable

---

## Infrastructure Dependency Matrix

| Component | VS Code API | Copilot API | Internal Services | ACP Relevance | Action |
|-----------|-------------|-------------|-------------------|---------------|--------|
| **Workspace Service** | ✅ High | ❌ None | ✅ Low | ✅ High | ✅ Keep |
| **File System Service** | ✅ High | ❌ None | ✅ Low | ✅ High | ✅ Keep |
| **Terminal Service** | ✅ Medium | ❌ None | ✅ Low | ✅ High | ✅ Keep |
| **Search Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Language Features** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Git Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **GitHub Service** | ✅ Medium | ✅ High | ✅ High | ❌ Low | ❌ Remove |
| **Embeddings Service** | ❌ None | ✅ High | ✅ High | ❌ Low | ❌ Remove |
| **Remote Code Search** | ❌ None | ✅ High | ✅ High | ❌ Low | ❌ Remove |
| **Chunking Service** | ❌ None | ✅ High | ✅ Medium | ❌ Low | ❌ Remove |
| **Endpoint Provider** | ✅ Low | ✅ High | ✅ Medium | ❌ Low | ❌ Remove |
| **Networking Service** | ✅ Low | ✅ High | ✅ High | ❌ Low | ❌ Remove |
| **Dialog Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Notification Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Workbench Service** | ✅ High | ❌ None | ✅ Medium | ✅ Medium | ✅ Keep |
| **Editing Service** | ✅ Medium | ❌ None | ✅ Medium | ✅ High | ✅ Keep |
| **Diff Service** | ❌ None | ❌ None | ✅ Low | ✅ High | ✅ Keep |
| **Environment Service** | ✅ High | ❌ None | ✅ Low | ✅ High | ✅ Keep |
| **Extensions Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Testing Service** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |
| **Notebook Service** | ✅ High | ✅ Medium | ✅ Medium | ❌ Low | ❌ Remove |
| **Image Service** | ❌ None | ✅ High | ✅ Medium | ❌ Low | ❌ Remove |
| **Thinking Service** | ❌ None | ✅ Medium | ✅ Low | ✅ Medium | ⚠️ Adapt |
| **Review Service** | ✅ High | ✅ Medium | ✅ Medium | ❌ Low | ❌ Remove |
| **Heatmap Service** | ✅ Medium | ✅ Medium | ✅ Low | ❌ Low | ❌ Remove |
| **Ignore Service** | ✅ Medium | ✅ High | ✅ Medium | ❌ Low | ❌ Remove |
| **Scope Selection** | ✅ High | ❌ None | ✅ Low | ✅ Medium | ✅ Keep |

---

## Immediate Actions Required

### 1. Remove Copilot-Specific Infrastructure

**Components to Remove:**
- `src/platform/github/` - GitHub Copilot API integration
- `src/platform/embeddings/` - Copilot-specific embeddings
- `src/platform/remoteCodeSearch/` - Copilot-specific remote search
- `src/platform/chunking/` - Copilot-specific chunking
- `src/platform/endpoint/` - Copilot-specific endpoints
- `src/platform/networking/` - Copilot-specific networking
- `src/platform/notebook/` - Copilot-specific notebook features
- `src/platform/image/` - Copilot-specific image upload
- `src/platform/review/` - Copilot-specific code review
- `src/platform/heatmap/` - Copilot-specific heatmap
- `src/platform/ignore/` - Copilot-specific content exclusion

**Impact:**
- Removes ~11 platform components
- Reduces codebase complexity significantly
- Eliminates proprietary API dependencies
- Simplifies service registration

---

### 2. Keep Reusable Infrastructure

**Components to Keep:**
- `src/platform/workspace/` - Essential for file operations
- `src/platform/filesystem/` - Essential for file system
- `src/platform/terminal/` - Essential for ACP terminal control
- `src/platform/search/` - Useful for code search
- `src/platform/languages/` - Useful for code navigation
- `src/platform/git/` - Useful for version control context
- `src/platform/dialog/` - Useful for user interaction
- `src/platform/notification/` - Useful for user feedback
- `src/platform/workbench/` - Useful for workspace introspection
- `src/platform/editing/` - Essential for text editing
- `src/platform/diff/` - Essential for diff operations
- `src/platform/env/` - Essential for environment context
- `src/platform/extensions/` - Useful for workspace capabilities
- `src/platform/testing/` - Useful for test context
- `src/platform/scopeSelection/` - Useful for code selection

**Impact:**
- Retains ~15 platform components
- Maintains essential infrastructure
- Keeps ACP-compatible services
- Preserves well-designed abstractions

---

### 3. Adapt Thinking Service

**Component to Adapt:**
- `src/platform/thinking/` - Simplify for ACP

**Modifications Required:**
1. Remove provider-specific fields (`cot_id`, `cot_summary`, `reasoning_opaque`, `reasoning_text`)
2. Simplify to generic `ThinkingData` structure
3. Align with ACP protocol's thinking steps
4. Remove encryption support (not relevant for ACP)

**New Interface:**
```typescript
export interface ThinkingData {
    id: string;
    text: string | string[];
    metadata?: { [key: string]: any };
}

export interface ThinkingDelta {
    id?: string;
    text?: string | string[];
    metadata?: { [key: string]: any };
}
```

---

### 4. Modify Notification Service

**Component to Modify:**
- `src/platform/notification/` - Remove Copilot-specific methods

**Modifications Required:**
1. Remove `showQuotaExceededDialog` (Copilot-specific)
2. Keep all other methods (generic VS Code notifications)

---

### 5. Modify Workbench Service

**Component to Modify:**
- `src/platform/workbench/` - Remove embeddings dependency

**Modifications Required:**
1. Remove dependency on `src/platform/embeddings/common/vscodeIndex`
2. Define `SettingListItem` locally:
```typescript
export interface SettingListItem {
    key: string;
    value: any;
    description?: string;
}
```

---

## Long-term Strategy

### Phase 1: Remove Copilot-Specific Infrastructure (Week 1)

1. **Remove GitHub Service**
   - Delete `src/platform/github/`
   - Remove from service registration
   - Remove from contributions

2. **Remove Embeddings Service**
   - Delete `src/platform/embeddings/`
   - Remove from service registration
   - Remove from contributions

3. **Remove Remote Code Search**
   - Delete `src/platform/remoteCodeSearch/`
   - Remove from service registration
   - Remove from contributions

4. **Remove Chunking Service**
   - Delete `src/platform/chunking/`
   - Remove from service registration
   - Remove from contributions

5. **Remove Endpoint Provider**
   - Delete `src/platform/endpoint/`
   - Remove from service registration
   - Remove from contributions

6. **Remove Networking Service**
   - Delete `src/platform/networking/`
   - Remove from service registration
   - Remove from contributions

7. **Remove Notebook Service**
   - Delete `src/platform/notebook/`
   - Remove from service registration
   - Remove from contributions

8. **Remove Image Service**
   - Delete `src/platform/image/`
   - Remove from service registration
   - Remove from contributions

9. **Remove Review Service**
   - Delete `src/platform/review/`
   - Remove from service registration
   - Remove from contributions

10. **Remove Heatmap Service**
    - Delete `src/platform/heatmap/`
    - Remove from service registration
    - Remove from contributions

11. **Remove Ignore Service**
    - Delete `src/platform/ignore/`
    - Remove from service registration
    - Remove from contributions

---

### Phase 2: Adapt Thinking Service (Week 1)

1. **Simplify Thinking Types**
   - Remove provider-specific fields
   - Align with ACP protocol
   - Remove encryption support

2. **Update Thinking Service**
   - Update all usages to new interface
   - Remove provider-specific logic
   - Test with ACP agents

---

### Phase 3: Modify Notification & Workbench Services (Week 1)

1. **Update Notification Service**
   - Remove `showQuotaExceededDialog`
   - Update all usages

2. **Update Workbench Service**
   - Remove embeddings dependency
   - Define `SettingListItem` locally
   - Update all usages

---

### Phase 4: Verify Reusable Infrastructure (Week 2)

1. **Test Workspace Service**
   - Verify file operations work with ACP
   - Test document events
   - Test workspace folder operations

2. **Test File System Service**
   - Verify CRUD operations
   - Test file watching
   - Test JSON caching

3. **Test Terminal Service**
   - Verify terminal buffer access
   - Test last command detection
   - Test shell type detection

4. **Test Search Service**
   - Verify file search
   - Test text search
   - Verify `StubSearchService` for `findFiles2`

5. **Test Language Features Service**
   - Verify definitions/references
   - Test symbol search
   - Test diagnostics access

6. **Test Git Service**
   - Verify repository context
   - Test log/diff operations
   - Test merge base detection

7. **Test Dialog Service**
   - Verify quick picks
   - Test open dialogs

8. **Test Notification Service**
   - Verify information messages
   - Test warning messages
   - Test progress indicators

9. **Test Workbench Service**
   - Verify extension enumeration
   - Test command enumeration
   - Test settings enumeration

10. **Test Editing Service**
    - Verify text edit creation
    - Test document snapshots
    - Test offset/position conversion

11. **Test Diff Service**
    - Verify diff computation
    - Test with various inputs

12. **Test Environment Service**
    - Verify environment info
    - Test session/machine ID
    - Test editor info

13. **Test Extensions Service**
    - Verify extension enumeration
    - Test extension lookup

14. **Test Testing Service**
    - Verify test failure access
    - Test with no-op stub

15. **Test Scope Selection Service**
    - Verify scope selection
    - Test with various code structures

---

## Testing Impact

### Tests to Remove

**Copilot-Specific Infrastructure Tests:**
- `test/unit/platform/github/` - GitHub service tests
- `test/unit/platform/embeddings/` - Embeddings service tests
- `test/unit/platform/remoteCodeSearch/` - Remote code search tests
- `test/unit/platform/chunking/` - Chunking service tests
- `test/unit/platform/endpoint/` - Endpoint provider tests
- `test/unit/platform/networking/` - Networking service tests
- `test/unit/platform/notebook/` - Notebook service tests
- `test/unit/platform/image/` - Image service tests
- `test/unit/platform/review/` - Review service tests
- `test/unit/platform/heatmap/` - Heatmap service tests
- `test/unit/platform/ignore/` - Ignore service tests

**Estimated Removal:** ~200+ tests

---

### Tests to Keep

**Reusable Infrastructure Tests:**
- `test/unit/platform/workspace/` - Workspace service tests
- `test/unit/platform/filesystem/` - File system service tests
- `test/unit/platform/terminal/` - Terminal service tests
- `test/unit/platform/search/` - Search service tests
- `test/unit/platform/languages/` - Language features tests
- `test/unit/platform/git/` - Git service tests
- `test/unit/platform/dialog/` - Dialog service tests
- `test/unit/platform/notification/` - Notification service tests
- `test/unit/platform/workbench/` - Workbench service tests
- `test/unit/platform/editing/` - Editing service tests
- `test/unit/platform/diff/` - Diff service tests
- `test/unit/platform/env/` - Environment service tests
- `test/unit/platform/extensions/` - Extensions service tests
- `test/unit/platform/testing/` - Testing service tests
- `test/unit/platform/scopeSelection/` - Scope selection tests

**Estimated Retention:** ~150+ tests

---

### Tests to Update

**Thinking Service Tests:**
- Update to new simplified interface
- Remove provider-specific tests
- Add ACP-specific tests

**Notification Service Tests:**
- Remove `showQuotaExceededDialog` tests

**Workbench Service Tests:**
- Update to new `SettingListItem` definition

**Estimated Updates:** ~20 tests

---

## Service Registration Impact

### Services to Remove from Registration

**In `src/extension/extension/vscode-node/services.ts`:**
- `IGithubRepositoryService` / `IOctoKitService`
- `IEmbeddingsComputer`
- `IGithubCodeSearchService`
- `IChunkingEndpointClient`
- `IEndpointProvider`
- `IFetcher` / `IFetcherService`
- `INotebookService`
- `IImageService`
- `IReviewService`
- `IHeatmapService`
- `IIgnoreService`

**Estimated Removal:** ~11 service registrations

---

### Services to Keep in Registration

**In `src/extension/extension/vscode-node/services.ts`:**
- `IWorkspaceService`
- `IFileSystemService`
- `ITerminalService`
- `ISearchService` (with `StubSearchService`)
- `ILanguageFeaturesService`
- `IGitService`
- `IDialogService`
- `INotificationService`
- `IWorkbenchService`
- `IEditingService` (if exists)
- `IDiffService`
- `IEnvService`
- `IExtensionsService`
- `ITestProvider`
- `IScopeSelector`

**Estimated Retention:** ~15 service registrations

---

## Risk Assessment

### High Risk Components (Remove)

**GitHub Service:**
- **Risk:** Breaking changes to any code using GitHub API integration
- **Mitigation:** Remove all usages before removing service
- **Impact:** High (used by remote code search, tools)

**Embeddings Service:**
- **Risk:** Breaking changes to code search and context gathering
- **Mitigation:** Remove all usages before removing service
- **Impact:** High (used by workspace chunk search, codebase tool)

**Endpoint Provider:**
- **Risk:** Breaking changes to chat/completion requests
- **Mitigation:** Remove all usages before removing service
- **Impact:** Critical (used by chat core, completions)

**Networking Service:**
- **Risk:** Breaking changes to all HTTP requests
- **Mitigation:** Remove all usages before removing service
- **Impact:** Critical (used by chat core, completions, embeddings)

---

### Medium Risk Components (Keep/Adapt)

**Thinking Service:**
- **Risk:** Breaking changes to thinking step handling
- **Mitigation:** Update all usages to new interface
- **Impact:** Medium (used by chat UI, response processing)

**Notification Service:**
- **Risk:** Breaking changes to quota dialog
- **Mitigation:** Remove `showQuotaExceededDialog` usages first
- **Impact:** Low (only used in quota handling)

**Workbench Service:**
- **Risk:** Breaking changes to settings enumeration
- **Mitigation:** Define `SettingListItem` locally
- **Impact:** Low (only used in settings tool)

---

### Low Risk Components (Keep)

**All other reusable infrastructure:**
- **Risk:** Minimal (well-designed, no Copilot dependencies)
- **Mitigation:** None required
- **Impact:** None (already ACP-compatible)

---

## Action Plan

### Week 1: Remove Copilot-Specific Infrastructure

**Day 1-2: Remove GitHub, Embeddings, Remote Code Search**
1. Identify all usages of `IGithubRepositoryService`, `IOctoKitService`
2. Remove usages from tools, contributions, services
3. Delete `src/platform/github/`
4. Identify all usages of `IEmbeddingsComputer`
5. Remove usages from workspace chunk search, codebase tool
6. Delete `src/platform/embeddings/`
7. Identify all usages of `IGithubCodeSearchService`
8. Remove usages from tools, contributions
9. Delete `src/platform/remoteCodeSearch/`
10. Remove service registrations
11. Rebuild and verify

**Day 3-4: Remove Chunking, Endpoint, Networking**
1. Identify all usages of `IChunkingEndpointClient`
2. Remove usages from workspace chunk search
3. Delete `src/platform/chunking/`
4. Identify all usages of `IEndpointProvider`
5. Remove usages from chat core, completions
6. Delete `src/platform/endpoint/`
7. Identify all usages of `IFetcher`, `IFetcherService`
8. Remove usages from chat core, completions, embeddings
9. Delete `src/platform/networking/`
10. Remove service registrations
11. Rebuild and verify

**Day 5: Remove Notebook, Image, Review, Heatmap, Ignore**
1. Identify all usages of `INotebookService`
2. Remove usages from tools, contributions
3. Delete `src/platform/notebook/`
4. Identify all usages of `IImageService`
5. Remove usages from chat UI
6. Delete `src/platform/image/`
7. Identify all usages of `IReviewService`
8. Remove usages from contributions
9. Delete `src/platform/review/`
10. Identify all usages of `IHeatmapService`
11. Remove usages from contributions
12. Delete `src/platform/heatmap/`
13. Identify all usages of `IIgnoreService`
14. Remove usages from tools, contributions
15. Delete `src/platform/ignore/`
16. Remove service registrations
17. Rebuild and verify

---

### Week 2: Adapt Thinking, Modify Notification/Workbench, Verify Reusable Infrastructure

**Day 1: Adapt Thinking Service**
1. Update `src/platform/thinking/common/thinking.ts` to new interface
2. Identify all usages of `ThinkingData`, `ThinkingDelta`
3. Update usages to new interface
4. Remove provider-specific logic
5. Test with ACP agents
6. Rebuild and verify

**Day 2: Modify Notification & Workbench Services**
1. Remove `showQuotaExceededDialog` from `INotificationService`
2. Update all usages
3. Remove embeddings dependency from `IWorkbenchService`
4. Define `SettingListItem` locally
5. Update all usages
6. Rebuild and verify

**Day 3-5: Verify Reusable Infrastructure**
1. Test all 15 reusable infrastructure components
2. Verify ACP compatibility
3. Run unit tests
4. Run integration tests
5. Document any issues
6. Fix any issues
7. Rebuild and verify

---

## Success Criteria

### Immediate Success (Week 1)

- ✅ All 11 Copilot-specific infrastructure components removed
- ✅ All service registrations updated
- ✅ Extension builds without errors
- ✅ No references to removed services in codebase

---

### Complete Success (Week 2)

- ✅ Thinking service adapted to ACP protocol
- ✅ Notification service modified (quota dialog removed)
- ✅ Workbench service modified (embeddings dependency removed)
- ✅ All 15 reusable infrastructure components verified
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ Extension activates successfully
- ✅ ACP components work with reusable infrastructure

---

## Next Steps

1. **Proceed to Phase 7: Extension Components Analysis**
   - Analyze `src/extension/` components
   - Identify Copilot-specific features
   - Document removal/adaptation plan

2. **Create Comprehensive Removal Plan**
   - Combine findings from all phases
   - Create detailed removal checklist
   - Estimate effort and timeline

3. **Present Findings to User**
   - Summarize all research phases
   - Present comprehensive action plan
   - Request approval to proceed with implementation

---

## Conclusion

Phase 6 Infrastructure Analysis reveals a **mixed landscape** of reusable and Copilot-specific infrastructure:

- **15 components to KEEP** - Well-designed, ACP-compatible, essential infrastructure
- **11 components to REMOVE** - Tightly coupled to GitHub Copilot's proprietary systems
- **1 component to ADAPT** - Thinking service (simplify for ACP)
- **2 components to MODIFY** - Notification and Workbench services (minor changes)

The reusable infrastructure provides a **solid foundation** for ACP integration, while the Copilot-specific infrastructure can be **cleanly removed** without impacting ACP functionality.

**Key Insight:** The platform layer is well-architected with clear service boundaries, making it relatively straightforward to remove Copilot-specific components while preserving essential infrastructure.

**Next Phase:** Analyze `src/extension/` components to complete the comprehensive codebase analysis.

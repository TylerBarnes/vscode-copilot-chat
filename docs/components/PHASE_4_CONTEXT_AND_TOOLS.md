# Phase 4: Context & Tools Analysis

## Overview
This phase analyzes the Context & Tools components of the vscode-copilot-chat extension, focusing on context keys, tool registration, and related file providers. These components are heavily coupled to VS Code's proprietary language model APIs and GitHub Copilot services.

## Key Directories Analyzed
- `src/extension/contextKeys/` - Context key management and command registrations
- `src/extension/tools/` - Tool registration and implementation (42 tools)
- `src/extension/relatedFiles/` - Related file providers for Git and Test contexts

## 1. Context Keys (`src/extension/contextKeys/`)

### Core Components
- **`contextKeys.contribution.ts`** - Registers context keys and commands
- **`contextKeys.ts`** - Defines context key constants

### Key Findings
- **Purpose**: Manages VS Code context keys for UI state and command visibility
- **Dependencies**: VS Code command registration, internal services
- **ACP Relevance**: Low - Context keys are UI-specific and can be simplified
- **Conflicts**: Uses `github.copilot.*` command prefixes that need renaming
- **Action**: **Keep** but simplify and rename to `acp.copilot.*`

### Command Registrations
```typescript
// Current problematic commands:
- github.copilot.chat.focus
- github.copilot.chat.focusUp
- github.copilot.chat.focusDown
- github.copilot.sidebar.focus
// ... and many more
```

## 2. Tools System (`src/extension/tools/`)

### Architecture Overview
The tools system is a comprehensive framework for registering and executing AI tools through VS Code's Language Model APIs.

### Core Components

#### 2.1 Tool Registration (`tools.ts`)
- **`ToolsContribution`** - Main contribution class
- **Purpose**: Registers tools with `vscode.lm.registerTool`
- **Dependencies**: `IToolsService`, `ITelemetryService`, `IExperimentationService`
- **API Usage**: Heavy reliance on `vscode.lm.*` APIs
- **ACP Relevance**: **Remove** - Entire system is proprietary VS Code LM specific

#### 2.2 Tool Service (`toolsService.ts`)
- **`IToolsService`** - Interface for tool management
- **`BaseToolsService`** - Base implementation with telemetry
- **`NullToolsService`** - No-op stub implementation
- **Dependencies**: `ITelemetryService`, `IExperimentationService`, `IEmbeddingsComputer`
- **ACP Relevance**: **Remove** - Tightly coupled to VS Code LM APIs

#### 2.3 Tool Implementations (42 Tools)
All tools in `src/extension/tools/node/` are implemented as VS Code Language Model tools:

**File System Tools:**
- `readFileTool.tsx` - Read file contents
- `createFileTool.tsx` - Create new files
- `editFileToolUtils.tsx` - Edit file utilities
- `findFilesTool.tsx` - Find files by pattern
- `findTextInFilesTool.tsx` - Search text in files
- `listDirTool.tsx` - List directory contents
- `createDirectoryTool.tsx` - Create directories

**Code Analysis Tools:**
- `codebaseTool.tsx` - Codebase analysis
- `usagesTool.tsx` - Find symbol usages
- `searchWorkspaceSymbolsTool.tsx` - Search workspace symbols
- `getErrorsTool.tsx` - Get diagnostic errors
- `docTool.tsx` - Documentation generation

**Git & SCM Tools:**
- `scmChangesTool.ts` - SCM changes
- `githubRepoTool.tsx` - GitHub repository operations

**VS Code Integration Tools:**
- `vscodeAPITool.ts` - VS Code API access
- `vscodeCmdTool.tsx` - Execute VS Code commands
- `simpleBrowserTool.tsx` - Browser integration
- `installExtensionTool.tsx` - Extension installation

**Notebook Tools:**
- `editNotebookTool.tsx` - Edit notebooks
- `newNotebookTool.tsx` - Create notebooks
- `runNotebookCellTool.tsx` - Run notebook cells
- `getNotebookCellOutputTool.tsx` - Get cell output
- `notebookSummaryTool.tsx` - Notebook summaries

**Workspace & Project Tools:**
- `newWorkspaceTool.tsx` - Create new workspace
- `projectSetupInfoTool.tsx` - Project setup information
- `readProjectStructureTool.ts` - Analyze project structure

**Testing Tools:**
- `testFailureTool.tsx` - Test failure analysis
- `findTestsFilesTool.tsx` - Find test files

**AI & Memory Tools:**
- `memoryTool.tsx` - Memory management
- `runSubagentTool.ts` - Subagent execution
- `toolReplayTool.tsx` - Tool replay functionality
- `userPreferencesTool.tsx` - User preferences

**Utility Tools:**
- `applyPatchTool.tsx` - Apply patches
- `multiReplaceStringTool.tsx` - Multi-string replacement
- `replaceStringTool.tsx` - String replacement
- `insertEditTool.tsx` - Insert edits
- `editFileHealing.tsx` - File healing
- `getSearchViewResultsTool.tsx` - Search view results
- `todoListContextPrompt.tsx` - Todo list management

### Key Dependencies Across All Tools
```typescript
// Common problematic imports:
import { vscode } from '../../vscode/vscodeSingleton';
import { IToolsService } from '../common/toolsService';
import { ITelemetryService } from '../../telemetry/common/telemetry';
import { IExperimentationService } from '../../telemetry/common/nullExperimentationService';
import { IGitService } from '../../git/common/gitService';
import { INotebookService } from '../../notebook/common/notebookService';
import { IEmbeddingsComputer } from '../../embeddings/common/embeddingsComputer';
import { IEndpointProvider } from '../../endpoint/common/endpointProvider';
```

### Tool Registration Pattern
```typescript
// Each tool follows this pattern:
vscode.lm.registerTool('toolName', {
    name: 'toolName',
    description: 'Tool description',
    parameters: { /* schema */ },
    handler: async (params) => {
        // Tool implementation
    }
});
```

## 3. Related Files System (`src/extension/relatedFiles/`)

### Core Components
- **`relatedFiles.contribution.ts`** - Registers related file providers
- **`git/`** - Git-related file providers
- **`test/`** - Test-related file providers

### Key Findings
- **Purpose**: Provides contextually relevant files to the chat system
- **Dependencies**: `vscode.chat.registerRelatedFilesProvider`
- **API Usage**: Proprietary VS Code chat API
- **ACP Relevance**: **Remove** - Tied to VS Code chat infrastructure

### Provider Registration Pattern
```typescript
// Current problematic registration:
vscode.chat.registerRelatedFilesProvider('github.copilot', {
    provideRelatedFiles: async (context) => {
        // Provider implementation
    }
});
```

## 4. Contribution Dependency Matrix

| Component | VS Code LM APIs | Copilot Services | Telemetry | Git Service | Notebook Service | ACP Relevance |
|-----------|----------------|------------------|-----------|-------------|------------------|---------------|
| ToolsContribution | ✅ Heavy | ❌ | ✅ | ✅ | ✅ | Remove |
| BaseToolsService | ✅ Heavy | ❌ | ✅ | ✅ | ✅ | Remove |
| All 42 Tools | ✅ Heavy | ❌ | ✅ | ✅ | ✅ | Remove |
| ContextKeys | ❌ | ❌ | ❌ | ❌ | ❌ | Keep (simplify) |
| RelatedFiles | ❌ | ✅ | ❌ | ✅ | ❌ | Remove |

## 5. API Conflicts Analysis

### VS Code Language Model APIs
```typescript
// Problematic APIs used throughout:
vscode.lm.registerTool()      // Tool registration
vscode.lm.invokeTool()        // Tool invocation
vscode.lm.selectChatModels()  // Model selection
vscode.lm.onDidChangeChatModels() // Model change events
```

### VS Code Chat APIs
```typescript
// Problematic APIs in related files:
vscode.chat.registerRelatedFilesProvider() // Related files
vscode.chat.createChatParticipant()        // Chat participants (indirect)
```

## 6. ACP Transformation Strategy

### Immediate Actions Required
1. **Disable ToolsContribution** - Remove from `contributions.ts`
2. **Disable RelatedFilesContribution** - Remove from `contributions.ts`
3. **Keep ContextKeys** - Simplify and rename commands to `acp.copilot.*`
4. **Remove All Tool Imports** - Remove from `allTools.ts`

### Long-term Strategy
1. **Replace with ACP Tool System** - Use ACP's tool call infrastructure
2. **Implement ACP File System Handler** - Replace file system tools
3. **Create ACP Context Manager** - Replace context key system
4. **Implement ACP Session Manager** - Replace related files concept

### Migration Path
```typescript
// Current proprietary approach:
vscode.lm.registerTool('readFile', { /* VS Code LM tool */ });

// Future ACP approach:
await acpClient.callTool('readFile', { path: 'file.txt' });
```

## 7. Testing Impact

### Current Test Coverage
- **Unit Tests**: Extensive coverage for all 42 tools
- **Integration Tests**: Tool service integration tests
- **Test Files**: 20+ test files in `tools/node/test/`

### ACP Migration Impact
- **Remove All Tool Tests** - Tests are VS Code LM specific
- **Keep Context Key Tests** - Simplified and renamed
- **Create New ACP Tool Tests** - Test ACP tool call infrastructure

## 8. Configuration Dependencies

### Current Configuration
```json
{
    "github.copilot.chat.experimental.tools": {
        "type": "boolean",
        "default": false
    }
}
```

### ACP Configuration
```json
{
    "acp.copilot.tools.enabled": {
        "type": "boolean", 
        "default": true
    },
    "acp.copilot.tools.allowedTools": {
        "type": "array",
        "default": ["readFile", "writeFile", "listDirectory"]
    }
}
```

## 9. Action Plan

### Phase 1: Disable Conflicting Components
1. Comment out `ToolsContribution` in `contributions.ts`
2. Comment out `RelatedFilesContribution` in `contributions.ts`
3. Remove tool imports from `allTools.ts`
4. Test extension activation

### Phase 2: Simplify Context Keys
1. Update all command IDs to use `acp.copilot.*` prefix
2. Remove Copilot-specific context keys
3. Update command titles and descriptions
4. Test context key functionality

### Phase 3: Verify ACP Components
1. Ensure ACP tool system works independently
2. Test ACP file system operations
3. Verify ACP session management
4. Test ACP chat functionality

### Phase 4: Clean Up
1. Remove unused tool files and directories
2. Remove related files providers
3. Update configuration schema
4. Remove proprietary API dependencies

## 10. Risk Assessment

### High Risk Components
- **Tools System**: Complete removal required
- **Related Files**: Complete removal required
- **Tool Service**: Complete removal required

### Medium Risk Components
- **Context Keys**: Renaming and simplification required
- **Command Registrations**: Prefix updates required

### Low Risk Components
- **ACP Tool System**: Independent implementation
- **ACP File System**: Independent implementation

## 11. Success Criteria

### Immediate Success
- [ ] Extension activates without `vscode.lm.*` API errors
- [ ] No tool-related conflicts in extension host
- [ ] Context keys use `acp.copilot.*` prefix
- [ ] ACP chat functionality works

### Complete Success
- [ ] All proprietary tool components removed
- [ ] ACP tool system fully functional
- [ ] File system operations work via ACP
- [ ] Session management works via ACP
- [ ] No VS Code LM API dependencies

## 12. Next Steps

1. **Proceed to Phase 5**: Supporting Features Analysis
2. **Document Authentication System**: Analyze `src/platform/authentication/`
3. **Document Logging System**: Analyze `src/platform/log/`
4. **Document Configuration System**: Analyze `src/platform/configuration/`
5. **Continue Infrastructure Analysis**: Complete remaining components

This analysis reveals that the Context & Tools system is one of the most heavily coupled components to VS Code's proprietary APIs, requiring complete removal and replacement with ACP-native implementations.
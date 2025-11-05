# VS Code File System API Fix

## Problem

The extension was failing to initialize with the error:
```
TypeError: The "paths" argument must be of type string. Received undefined
```

This error originated from `AgentConfigManager` attempting to use Node.js `fs` and `path` modules with VS Code's virtual file system URIs.

## Root Cause

VS Code's `globalStorageUri` returns a `vscode.Uri` object representing a virtual file system path, not a regular file system path. The `AgentConfigManager` was using Node.js `fs` and `path` modules which expect string paths, not `vscode.Uri` objects.

## Solution

### 1. Updated `AgentConfigManager` to use VS Code's File System API

**File:** `src/platform/acp/agent-config.ts`

- Removed Node.js imports: `fs`, `path`, `os`
- Added VS Code import: `import * as vscode from 'vscode'`
- Changed `configPath: string` to `configUri: vscode.Uri`
- Updated `load()` method to use `vscode.workspace.fs.readFile()`
- Updated `save()` method to use `vscode.workspace.fs.writeFile()`
- Removed directory creation logic (handled by `ACPContribution`)

### 2. Updated `ACPContribution` to properly initialize storage

**File:** `src/platform/acp/acp.contribution.ts`

- Added proper directory existence check using `vscode.workspace.fs.stat()`
- Added directory creation using `vscode.workspace.fs.createDirectory()`
- Used `vscode.Uri.joinPath()` to construct config file URI
- Added explicit `await agentConfigManager.initialize()` call
- Removed `initialize()` call from `AgentConfigManager` constructor

### 3. Updated test mocks to support VS Code APIs

**File:** `test/unit/acp/agent-config.spec.ts`

- Added VS Code API mock with `workspace.fs` methods
- Mocked `vscode.Uri.file()` to return objects with `fsPath` property
- Mocked `readFile()` and `writeFile()` to use Node.js `fs` for tests

**File:** `test/unit/acp/acp-contribution.spec.ts`

- Added comprehensive VS Code API mock including:
  - `workspace.fs.stat()`, `createDirectory()`, `readFile()`, `writeFile()`
  - `Uri.file()` and `Uri.joinPath()`
  - `window.showWarningMessage()`
- Updated `AgentConfigManager` mock to include `initialize()` method

## Key Learnings

1. **VS Code URIs are not file paths**: `vscode.Uri` objects represent virtual file system paths and must be used with `vscode.workspace.fs` APIs, not Node.js `fs` module.

2. **Use `vscode.Uri.joinPath()` for path manipulation**: Instead of Node.js `path.join()`, use `vscode.Uri.joinPath()` to construct URIs.

3. **Async initialization**: When using async initialization in constructors, ensure it's properly awaited before using the initialized state.

4. **Test mocking**: When using VS Code APIs, comprehensive mocking is required for unit tests to work correctly.

## Results

- ✅ All 451 ACP unit tests passing
- ✅ All 8 ACP integration tests passing
- ✅ TypeScript check passes with no errors
- ✅ Extension builds and packages successfully (225.95 KB)
- ✅ No more `TypeError: The "paths" argument must be of type string. Received undefined` errors

## Next Steps

1. Install the new `.vsix` package
2. Reload VS Code
3. Verify the custom chat UI loads correctly
4. Check that the extension prompts to configure an ACP agent profile

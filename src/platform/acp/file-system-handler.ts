import * as vscode from 'vscode';
import type { FsReadTextFileParams, FsReadTextFileResult, FsWriteTextFileParams } from './types';

/**
 * Handles file system operations for ACP agents.
 * Enforces security boundaries by restricting access to files within the workspace (cwd).
 */
export class FileSystemHandler {
    private readonly workspaceUri: vscode.Uri;

    constructor(cwd: string) {
        // Convert cwd string to URI
        this.workspaceUri = vscode.Uri.file(cwd);
    }

    /**
     * Validates that a path is absolute and within the allowed workspace.
     * @param filePath The path to validate
     * @returns The validated URI
     * @throws Error if the path is invalid or outside the workspace
     */
    private validatePath(filePath: string): vscode.Uri {
        // Convert to URI
        const fileUri = vscode.Uri.file(filePath);
        
        // Check if the file path starts with the workspace path
        const workspacePath = this.workspaceUri.fsPath;
        const normalizedFilePath = fileUri.fsPath;
        
        if (!normalizedFilePath.startsWith(workspacePath)) {
            throw new Error('Path is outside the allowed workspace');
        }

        return fileUri;
    }

    /**
     * Reads a text file from the file system.
     * @param params Parameters containing the file path
     * @returns The file content
     */
    async readTextFile(params: FsReadTextFileParams): Promise<FsReadTextFileResult> {
        const validatedUri = this.validatePath(params.path);

        try {
            const data = await vscode.workspace.fs.readFile(validatedUri);
            const content = Buffer.from(data).toString('utf-8');
            return { content };
        } catch (error) {
            if ((error as any).code === 'FileNotFound') {
                throw new Error(`File not found: ${params.path}`);
            }
            throw error;
        }
    }

    /**
     * Writes a text file to the file system.
     * Creates parent directories if they don't exist.
     * @param params Parameters containing the file path and content
     */
    async writeTextFile(params: FsWriteTextFileParams): Promise<void> {
        const validatedUri = this.validatePath(params.path);

        // Ensure parent directory exists
        const parentUri = vscode.Uri.joinPath(validatedUri, '..');
        try {
            await vscode.workspace.fs.createDirectory(parentUri);
        } catch (error) {
            // Directory might already exist, ignore
        }

        // Write the file
        const content = Buffer.from(params.content, 'utf-8');
        await vscode.workspace.fs.writeFile(validatedUri, content);
    }

    /**
     * Gets the current working directory (workspace root).
     */
    getCwd(): string {
        return this.workspaceUri.fsPath;
    }
}

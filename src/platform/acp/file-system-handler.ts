import * as fs from 'fs/promises';
import * as path from 'path';
import type { FsReadTextFileParams, FsReadTextFileResult, FsWriteTextFileParams } from './types';

/**
 * Handles file system operations for ACP agents.
 * Enforces security boundaries by restricting access to files within the workspace (cwd).
 */
export class FileSystemHandler {
	private readonly cwd: string;

	constructor(cwd: string) {
		// Normalize and resolve cwd to an absolute path
		this.cwd = path.resolve(cwd);
	}

	/**
	 * Validates that a path is absolute and within the allowed workspace.
	 * @param filePath The path to validate
	 * @throws Error if the path is invalid or outside the workspace
	 */
	private async validatePath(filePath: string): Promise<string> {
		// Require absolute paths
		if (!path.isAbsolute(filePath)) {
			throw new Error('Path must be absolute');
		}

		// Resolve the path to handle symlinks and normalize
		let resolvedPath: string;
		let resolvedCwd: string;
		
		try {
			resolvedPath = await fs.realpath(filePath);
		} catch (error) {
			// If realpath fails (e.g., file doesn't exist), use path.resolve
			// This is needed for write operations where the file may not exist yet
			resolvedPath = path.resolve(filePath);
		}

		try {
			resolvedCwd = await fs.realpath(this.cwd);
		} catch (error) {
			resolvedCwd = this.cwd;
		}

		// Ensure the resolved path is within the resolved cwd
		const relativePath = path.relative(resolvedCwd, resolvedPath);
		if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
			throw new Error('Path is outside the allowed workspace');
		}

		return resolvedPath;
	}

	/**
	 * Reads a text file from the file system.
	 * @param params Parameters containing the file path
	 * @returns The file content
	 */
	async readTextFile(params: FsReadTextFileParams): Promise<FsReadTextFileResult> {
		const validatedPath = await this.validatePath(params.path);

		try {
			const content = await fs.readFile(validatedPath, 'utf-8');
			return { content };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
        // For write operations, we need to validate the parent directory exists within cwd
        // but the file itself may not exist yet
        if (!path.isAbsolute(params.path)) {
            throw new Error('Path must be absolute');
        }

        const resolvedPath = path.resolve(params.path);
        let resolvedCwd: string;
        
        try {
            resolvedCwd = await fs.realpath(this.cwd);
        } catch (error) {
            resolvedCwd = this.cwd;
        }

        // For write operations, resolve the parent directory to handle symlinks
        const parentDir = path.dirname(resolvedPath);
        let resolvedParentDir: string;
        try {
            // Create parent directories first if they don't exist
            await fs.mkdir(parentDir, { recursive: true });
            resolvedParentDir = await fs.realpath(parentDir);
        } catch (error) {
            resolvedParentDir = parentDir;
        }

        // Check if the parent directory is within cwd
        const relativePath = path.relative(resolvedCwd, resolvedParentDir);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error('Path is outside the allowed workspace');
        }

        // Write the file
        const fileName = path.basename(resolvedPath);
        const finalPath = path.join(resolvedParentDir, fileName);
        await fs.writeFile(finalPath, params.content, 'utf-8');
    }

	/**
	 * Gets the current working directory (workspace root).
	 */
	getCwd(): string {
		return this.cwd;
	}
}

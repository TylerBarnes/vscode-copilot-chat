import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileSystemHandler } from '../../../src/platform/acp/file-system-handler';
import * as vscode from 'vscode';

vi.mock('vscode', () => ({
    Uri: {
        file: vi.fn((path: string) => {
            // Normalize path by resolving .. and . segments
            const segments = path.split('/').filter(s => s !== '');
            const normalized: string[] = [];
            for (const segment of segments) {
                if (segment === '..') {
                    normalized.pop();
                } else if (segment !== '.') {
                    normalized.push(segment);
                }
            }
            const normalizedPath = '/' + normalized.join('/');
            return { fsPath: normalizedPath, scheme: 'file', path: normalizedPath };
        }),
        joinPath: vi.fn((base: any, ...segments: string[]) => ({
            fsPath: `${base.fsPath}/${segments.join('/')}`,
            scheme: 'file',
            path: `${base.fsPath}/${segments.join('/')}`,
        })),
    },
    workspace: {
        fs: {
            createDirectory: vi.fn(),
            readFile: vi.fn(),
            writeFile: vi.fn(),
        },
    },
}));

describe('FileSystemHandler', () => {
    let handler: FileSystemHandler;
    let testDir: string;

    beforeEach(() => {
        testDir = '/test/workspace';
        handler = new FileSystemHandler(testDir);
        
        vi.clearAllMocks();
    });

    describe('readTextFile', () => {
        it('should read a text file within cwd', async () => {
            const filePath = `${testDir}/test.txt`;
            const content = 'Hello, World!';
            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(content));

            const result = await handler.readTextFile({ path: filePath });

            expect(result.content).toBe(content);
        });

        it('should read a file in a subdirectory', async () => {
            const filePath = `${testDir}/subdir/nested.txt`;
            const content = 'Nested content';
            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(content));

            const result = await handler.readTextFile({ path: filePath });

            expect(result.content).toBe(content);
        });

        it('should reject reading files outside cwd', async () => {
            const outsidePath = '/tmp/outside.txt';

            await expect(handler.readTextFile({ path: outsidePath }))
                .rejects.toThrow('Path is outside the allowed workspace');
        });

        it('should reject reading files with relative paths that escape cwd', async () => {
            const escapePath = `${testDir}/../../escape.txt`;

            await expect(handler.readTextFile({ path: escapePath }))
                .rejects.toThrow('Path is outside the allowed workspace');
        });

        it('should reject reading non-existent files', async () => {
            const nonExistentPath = `${testDir}/does-not-exist.txt`;
            vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue({ code: 'FileNotFound' });

            await expect(handler.readTextFile({ path: nonExistentPath }))
                .rejects.toThrow('File not found');
        });

        it('should handle UTF-8 content correctly', async () => {
            const filePath = `${testDir}/unicode.txt`;
            const content = '你好世界 🌍 Привет мир';
            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(content));

            const result = await handler.readTextFile({ path: filePath });

            expect(result.content).toBe(content);
        });
	});

    describe('writeTextFile', () => {
        it('should write a text file within cwd', async () => {
            const filePath = `${testDir}/output.txt`;
            const content = 'Written content';

            await handler.writeTextFile({ path: filePath, content });

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ fsPath: filePath }),
                Buffer.from(content)
            );
        });

        it('should create parent directories if they do not exist', async () => {
            const filePath = `${testDir}/deep/nested/file.txt`;
            const content = 'Deep content';

            await handler.writeTextFile({ path: filePath, content });

            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should overwrite existing files', async () => {
            const filePath = `${testDir}/overwrite.txt`;
            const newContent = 'New content';

            await handler.writeTextFile({ path: filePath, content: newContent });

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ fsPath: filePath }),
                Buffer.from(newContent)
            );
        });

        it('should reject writing files outside cwd', async () => {
            const outsidePath = '/tmp/outside-write.txt';

            await expect(handler.writeTextFile({ path: outsidePath, content: 'Bad content' }))
                .rejects.toThrow('Path is outside the allowed workspace');
        });

        it('should reject writing files with relative paths that escape cwd', async () => {
            const escapePath = `${testDir}/../../escape-write.txt`;

            await expect(handler.writeTextFile({ path: escapePath, content: 'Bad content' }))
                .rejects.toThrow('Path is outside the allowed workspace');
        });

        it('should handle UTF-8 content correctly', async () => {
            const filePath = `${testDir}/unicode-write.txt`;
            const content = '你好世界 🌍 Привет мир';

            await handler.writeTextFile({ path: filePath, content });

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ fsPath: filePath }),
                Buffer.from(content)
            );
        });

        it('should handle empty content', async () => {
            const filePath = `${testDir}/empty.txt`;

            await handler.writeTextFile({ path: filePath, content: '' });

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                expect.objectContaining({ fsPath: filePath }),
                Buffer.from('')
            );
        });
	});

    describe('path validation', () => {
        it('should normalize paths before validation', async () => {
            const filePath = `${testDir}/subdir/../file.txt`;
            const content = 'Normalized content';
            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(content));

            const result = await handler.readTextFile({ path: filePath });

            expect(result.content).toBe(content);
        });
    });

    describe('getCwd', () => {
        it('should return the workspace directory', () => {
            expect(handler.getCwd()).toBe(testDir);
        });
    });
});

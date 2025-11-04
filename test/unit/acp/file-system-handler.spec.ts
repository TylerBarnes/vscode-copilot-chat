import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemHandler } from '../../../src/platform/acp/file-system-handler';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('FileSystemHandler', () => {
	let handler: FileSystemHandler;
	let testDir: string;
	let cwd: string;

	beforeEach(async () => {
		// Create a unique test directory
		testDir = path.join(tmpdir(), `acp-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await fs.mkdir(testDir, { recursive: true });
		cwd = testDir;

		handler = new FileSystemHandler(cwd);
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe('readTextFile', () => {
		it('should read a text file within cwd', async () => {
			const filePath = path.join(testDir, 'test.txt');
			const content = 'Hello, World!';
			await fs.writeFile(filePath, content, 'utf-8');

			const result = await handler.readTextFile({ path: filePath });

			expect(result.content).toBe(content);
		});

		it('should read a file in a subdirectory', async () => {
			const subDir = path.join(testDir, 'subdir');
			await fs.mkdir(subDir);
			const filePath = path.join(subDir, 'nested.txt');
			const content = 'Nested content';
			await fs.writeFile(filePath, content, 'utf-8');

			const result = await handler.readTextFile({ path: filePath });

			expect(result.content).toBe(content);
		});

		it('should reject reading files outside cwd', async () => {
			const outsidePath = path.join(tmpdir(), 'outside.txt');
			await fs.writeFile(outsidePath, 'Outside content', 'utf-8');

			await expect(handler.readTextFile({ path: outsidePath }))
				.rejects.toThrow('Path is outside the allowed workspace');

			// Clean up
			await fs.unlink(outsidePath);
		});

		it('should reject reading files with relative paths that escape cwd', async () => {
			const escapePath = path.join(testDir, '..', '..', 'escape.txt');

			await expect(handler.readTextFile({ path: escapePath }))
				.rejects.toThrow('Path is outside the allowed workspace');
		});

		it('should reject reading non-existent files', async () => {
			const nonExistentPath = path.join(testDir, 'does-not-exist.txt');

			await expect(handler.readTextFile({ path: nonExistentPath }))
				.rejects.toThrow();
		});

		it('should handle UTF-8 content correctly', async () => {
			const filePath = path.join(testDir, 'unicode.txt');
			const content = '你好世界 🌍 Привет мир';
			await fs.writeFile(filePath, content, 'utf-8');

			const result = await handler.readTextFile({ path: filePath });

			expect(result.content).toBe(content);
		});

		it('should require absolute paths', async () => {
			await expect(handler.readTextFile({ path: 'relative/path.txt' }))
				.rejects.toThrow('Path must be absolute');
		});
	});

	describe('writeTextFile', () => {
		it('should write a text file within cwd', async () => {
			const filePath = path.join(testDir, 'output.txt');
			const content = 'Written content';

			await handler.writeTextFile({ path: filePath, content });

			const fileContent = await fs.readFile(filePath, 'utf-8');
			expect(fileContent).toBe(content);
		});

		it('should create parent directories if they do not exist', async () => {
			const filePath = path.join(testDir, 'deep', 'nested', 'file.txt');
			const content = 'Deep content';

			await handler.writeTextFile({ path: filePath, content });

			const fileContent = await fs.readFile(filePath, 'utf-8');
			expect(fileContent).toBe(content);
		});

		it('should overwrite existing files', async () => {
			const filePath = path.join(testDir, 'overwrite.txt');
			await fs.writeFile(filePath, 'Original content', 'utf-8');

			const newContent = 'New content';
			await handler.writeTextFile({ path: filePath, content: newContent });

			const fileContent = await fs.readFile(filePath, 'utf-8');
			expect(fileContent).toBe(newContent);
		});

		it('should reject writing files outside cwd', async () => {
			const outsidePath = path.join(tmpdir(), 'outside-write.txt');

			await expect(handler.writeTextFile({ path: outsidePath, content: 'Bad content' }))
				.rejects.toThrow('Path is outside the allowed workspace');
		});

		it('should reject writing files with relative paths that escape cwd', async () => {
			const escapePath = path.join(testDir, '..', '..', 'escape-write.txt');

			await expect(handler.writeTextFile({ path: escapePath, content: 'Bad content' }))
				.rejects.toThrow('Path is outside the allowed workspace');
		});

		it('should handle UTF-8 content correctly', async () => {
			const filePath = path.join(testDir, 'unicode-write.txt');
			const content = '你好世界 🌍 Привет мир';

			await handler.writeTextFile({ path: filePath, content });

			const fileContent = await fs.readFile(filePath, 'utf-8');
			expect(fileContent).toBe(content);
		});

		it('should require absolute paths', async () => {
			await expect(handler.writeTextFile({ path: 'relative/path.txt', content: 'test' }))
				.rejects.toThrow('Path must be absolute');
		});

		it('should handle empty content', async () => {
			const filePath = path.join(testDir, 'empty.txt');

			await handler.writeTextFile({ path: filePath, content: '' });

			const fileContent = await fs.readFile(filePath, 'utf-8');
			expect(fileContent).toBe('');
		});
	});

	describe('path validation', () => {
		it('should normalize paths before validation', async () => {
			const filePath = path.join(testDir, 'subdir', '..', 'file.txt');
			const content = 'Normalized content';
			await fs.writeFile(path.join(testDir, 'file.txt'), content, 'utf-8');

			const result = await handler.readTextFile({ path: filePath });

			expect(result.content).toBe(content);
		});

		it('should handle symlinks within cwd', async () => {
			const targetPath = path.join(testDir, 'target.txt');
			const linkPath = path.join(testDir, 'link.txt');
			const content = 'Symlink content';
			await fs.writeFile(targetPath, content, 'utf-8');
			await fs.symlink(targetPath, linkPath);

			const result = await handler.readTextFile({ path: linkPath });

			expect(result.content).toBe(content);
		});

		it('should reject symlinks that point outside cwd', async () => {
			const outsideTarget = path.join(tmpdir(), 'outside-target.txt');
			const linkPath = path.join(testDir, 'bad-link.txt');
			await fs.writeFile(outsideTarget, 'Outside content', 'utf-8');
			await fs.symlink(outsideTarget, linkPath);

			await expect(handler.readTextFile({ path: linkPath }))
				.rejects.toThrow('Path is outside the allowed workspace');

			// Clean up
			await fs.unlink(linkPath);
			await fs.unlink(outsideTarget);
		});
	});
});

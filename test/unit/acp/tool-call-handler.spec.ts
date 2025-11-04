import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ToolCallHandler } from '../../../src/platform/acp/tool-call-handler';
import { FileSystemHandler } from '../../../src/platform/acp/file-system-handler';
import { TerminalManager } from '../../../src/platform/acp/terminal-manager';
import { ToolCallKind, ToolCallStatus, type ToolCall, type ToolResult } from '../../../src/platform/acp/types';

vi.mock('vscode', () => ({
    window: {
        showWarningMessage: vi.fn(),
    },
}));

describe('ToolCallHandler', () => {
    let toolCallHandler: ToolCallHandler;
    let mockFileSystemHandler: Partial<FileSystemHandler>;
    let mockTerminalManager: Partial<TerminalManager>;
    let mockStream: Partial<vscode.ChatResponseStream>;

    beforeEach(() => {
        mockFileSystemHandler = {
            readTextFile: vi.fn(),
            writeTextFile: vi.fn(),
        };

        mockTerminalManager = {
            createTerminal: vi.fn(),
            sendInput: vi.fn(),
            killTerminal: vi.fn(),
            getOutput: vi.fn(),
        };

        mockStream = {
            markdown: vi.fn(),
            progress: vi.fn(),
        };

        toolCallHandler = new ToolCallHandler(
            mockFileSystemHandler as FileSystemHandler,
            mockTerminalManager as TerminalManager
        );

        // Reset window mock
        vi.mocked(vscode.window.showWarningMessage).mockReset();
    });

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('displayToolCall', () => {
		it('should display pending tool call', () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Pending,
				input: { path: '/test/file.txt' },
			};

			toolCallHandler.displayToolCall(toolCall, mockStream as vscode.ChatResponseStream);

			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('🔧 **Tool Call:** read_text_file')
			);
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('⏳ Status: pending')
			);
		});

		it('should display completed tool call', () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Completed,
				input: { path: '/test/file.txt' },
			};

			toolCallHandler.displayToolCall(toolCall, mockStream as vscode.ChatResponseStream);

			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('✅ Status: completed')
			);
		});

		it('should display error tool call', () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Error,
				input: { path: '/test/file.txt' },
				error: 'File not found',
			};

			toolCallHandler.displayToolCall(toolCall, mockStream as vscode.ChatResponseStream);

			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('❌ Status: error')
			);
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('File not found')
			);
		});

		it('should display awaiting permission tool call', () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			toolCallHandler.displayToolCall(toolCall, mockStream as vscode.ChatResponseStream);

			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('🔒 Status: awaiting_permission')
			);
		});

		it('should format tool input as JSON', () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Pending,
				input: { path: '/test/file.txt', encoding: 'utf-8' },
			};

			toolCallHandler.displayToolCall(toolCall, mockStream as vscode.ChatResponseStream);

			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('```json')
			);
			expect(mockStream.markdown).toHaveBeenCalledWith(
				expect.stringContaining('"path": "/test/file.txt"')
			);
		});
	});

	describe('executeTool', () => {
		it('should execute read_text_file tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Pending,
				input: { path: '/test/file.txt' },
			};

			vi.mocked(mockFileSystemHandler.readTextFile).mockResolvedValue('file content');

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockFileSystemHandler.readTextFile).toHaveBeenCalledWith('/test/file.txt');
			expect(result).toEqual({
				toolCallId: 'tool-1',
				content: 'file content',
			});
		});

		it('should execute write_text_file tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-2',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.Pending,
				input: { path: '/test/file.txt', content: 'new content' },
			};

			vi.mocked(mockFileSystemHandler.writeTextFile).mockResolvedValue(undefined);

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockFileSystemHandler.writeTextFile).toHaveBeenCalledWith(
				'/test/file.txt',
				'new content'
			);
			expect(result).toEqual({
				toolCallId: 'tool-2',
				content: 'File written successfully',
			});
		});

		it('should execute terminal_create tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-3',
				kind: ToolCallKind.TerminalCreate,
				status: ToolCallStatus.Pending,
				input: { name: 'test-terminal' },
			};

			vi.mocked(mockTerminalManager.createTerminal).mockResolvedValue('term-123');

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockTerminalManager.createTerminal).toHaveBeenCalledWith('test-terminal');
			expect(result).toEqual({
				toolCallId: 'tool-3',
				content: JSON.stringify({ terminalId: 'term-123' }),
			});
		});

		it('should execute terminal_send_input tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-4',
				kind: ToolCallKind.TerminalSendInput,
				status: ToolCallStatus.Pending,
				input: { terminalId: 'term-123', input: 'echo hello' },
			};

			vi.mocked(mockTerminalManager.sendInput).mockResolvedValue(undefined);

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockTerminalManager.sendInput).toHaveBeenCalledWith('term-123', 'echo hello');
			expect(result).toEqual({
				toolCallId: 'tool-4',
				content: 'Input sent to terminal',
			});
		});

		it('should execute terminal_kill tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-5',
				kind: ToolCallKind.TerminalKill,
				status: ToolCallStatus.Pending,
				input: { terminalId: 'term-123' },
			};

			vi.mocked(mockTerminalManager.killTerminal).mockResolvedValue(undefined);

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockTerminalManager.killTerminal).toHaveBeenCalledWith('term-123');
			expect(result).toEqual({
				toolCallId: 'tool-5',
				content: 'Terminal killed',
			});
		});

		it('should execute terminal_get_output tool', async () => {
			const toolCall: ToolCall = {
				id: 'tool-6',
				kind: ToolCallKind.TerminalGetOutput,
				status: ToolCallStatus.Pending,
				input: { terminalId: 'term-123' },
			};

			vi.mocked(mockTerminalManager.getOutput).mockReturnValue('terminal output');

			const result = await toolCallHandler.executeTool(toolCall);

			expect(mockTerminalManager.getOutput).toHaveBeenCalledWith('term-123');
			expect(result).toEqual({
				toolCallId: 'tool-6',
				content: 'terminal output',
			});
		});

		it('should handle tool execution errors', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.ReadTextFile,
				status: ToolCallStatus.Pending,
				input: { path: '/test/file.txt' },
			};

			vi.mocked(mockFileSystemHandler.readTextFile).mockRejectedValue(
				new Error('File not found')
			);

			const result = await toolCallHandler.executeTool(toolCall);

			expect(result).toEqual({
				toolCallId: 'tool-1',
				isError: true,
				content: 'File not found',
			});
		});

		it('should handle unknown tool kinds', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: 'unknown_tool' as ToolCallKind,
				status: ToolCallStatus.Pending,
				input: {},
			};

			const result = await toolCallHandler.executeTool(toolCall);

			expect(result).toEqual({
				toolCallId: 'tool-1',
				isError: true,
				content: 'Unknown tool kind: unknown_tool',
			});
		});
	});

	describe('requestPermission', () => {
		it('should request permission for write operations', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			// Mock user approval
			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Allow' as any);

			const decision = await toolCallHandler.requestPermission(toolCall);

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining('write_text_file'),
				expect.objectContaining({ modal: true }),
				'Allow',
				'Reject',
				'Allow Always',
				'Reject Always'
			);
			expect(decision).toBe('allow_once');
		});

		it('should return allow_once for Allow button', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Allow' as any);

			const decision = await toolCallHandler.requestPermission(toolCall);
			expect(decision).toBe('allow_once');
		});

		it('should return reject_once for Reject button', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Reject' as any);

			const decision = await toolCallHandler.requestPermission(toolCall);
			expect(decision).toBe('reject_once');
		});

		it('should return allow_always for Allow Always button', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Allow Always' as any);

			const decision = await toolCallHandler.requestPermission(toolCall);
			expect(decision).toBe('allow_always');
		});

		it('should return reject_always for Reject Always button', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Reject Always' as any);

			const decision = await toolCallHandler.requestPermission(toolCall);
			expect(decision).toBe('reject_always');
		});

		it('should return reject_once if user dismisses dialog', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/test/file.txt', content: 'test' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);

			const decision = await toolCallHandler.requestPermission(toolCall);
			expect(decision).toBe('reject_once');
		});

		it('should include tool input in permission request', async () => {
			const toolCall: ToolCall = {
				id: 'tool-1',
				kind: ToolCallKind.WriteTextFile,
				status: ToolCallStatus.AwaitingPermission,
				input: { path: '/important/file.txt', content: 'sensitive data' },
			};

			vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Allow' as any);

			await toolCallHandler.requestPermission(toolCall);

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining('/important/file.txt'),
				expect.any(Object),
				expect.any(String),
				expect.any(String),
				expect.any(String),
				expect.any(String)
			);
		});
	});
});

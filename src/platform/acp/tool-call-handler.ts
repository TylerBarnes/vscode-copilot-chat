import * as vscode from 'vscode';
import { FileSystemHandler } from './file-system-handler';
import { TerminalManager } from './terminal-manager';
import {
	ToolCallKind,
	ToolCallStatus,
	type ToolCall,
	type ToolResult,
	type PermissionDecision,
} from './types';

/**
 * Handles tool call execution, display, and permission requests for ACP agents.
 */
export class ToolCallHandler {
	constructor(
		private readonly fileSystemHandler: FileSystemHandler,
		private readonly terminalManager: TerminalManager
	) {}

	/**
	 * Display a tool call in the chat stream with status and input details.
	 */
	displayToolCall(toolCall: ToolCall, stream: vscode.ChatResponseStream): void {
		const statusIcon = this.getStatusIcon(toolCall.status);
		const kindDisplay = this.formatToolKind(toolCall.kind);

		stream.markdown(`🔧 **Tool Call:** ${kindDisplay}

${statusIcon} Status: ${toolCall.status}

`);

        if (toolCall.input && Object.keys(toolCall.input).length > 0) {
            stream.markdown(`**Input:**
\`\`\`json
${JSON.stringify(toolCall.input, null, 2)}
\`\`\`

`);
		}

		if (toolCall.error) {
			stream.markdown(`❌ **Error:** ${toolCall.error}

`);
		}
	}

	/**
	 * Execute a tool call and return the result.
	 */
	async executeTool(toolCall: ToolCall): Promise<ToolResult> {
		try {
			switch (toolCall.kind) {
				case ToolCallKind.ReadTextFile:
					return await this.executeReadTextFile(toolCall);
				case ToolCallKind.WriteTextFile:
					return await this.executeWriteTextFile(toolCall);
				case ToolCallKind.TerminalCreate:
					return await this.executeTerminalCreate(toolCall);
				case ToolCallKind.TerminalSendInput:
					return await this.executeTerminalSendInput(toolCall);
				case ToolCallKind.TerminalKill:
					return await this.executeTerminalKill(toolCall);
				case ToolCallKind.TerminalGetOutput:
					return await this.executeTerminalGetOutput(toolCall);
				default:
					return {
						toolCallId: toolCall.id,
						isError: true,
						content: `Unknown tool kind: ${toolCall.kind}`,
					};
			}
		} catch (error) {
			return {
				toolCallId: toolCall.id,
				isError: true,
				content: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Request permission from the user for a tool call.
	 */
	async requestPermission(toolCall: ToolCall): Promise<PermissionDecision> {
		const kindDisplay = this.formatToolKind(toolCall.kind);
		const inputPreview = JSON.stringify(toolCall.input, null, 2);

		const message = `The agent wants to execute: **${kindDisplay}**

${inputPreview}

Do you want to allow this?`;

		const choice = await vscode.window.showWarningMessage(
			message,
			{ modal: true },
			'Allow',
			'Reject',
			'Allow Always',
			'Reject Always'
		);

		switch (choice) {
			case 'Allow':
				return 'allow_once';
			case 'Reject':
				return 'reject_once';
			case 'Allow Always':
				return 'allow_always';
			case 'Reject Always':
				return 'reject_always';
			default:
				return 'reject_once';
		}
	}

	// Private helper methods

	private getStatusIcon(status: ToolCallStatus): string {
		switch (status) {
			case ToolCallStatus.Pending:
				return '⏳';
			case ToolCallStatus.Completed:
				return '✅';
			case ToolCallStatus.Error:
				return '❌';
			case ToolCallStatus.AwaitingPermission:
				return '🔒';
			default:
				return '❓';
		}
	}

	private formatToolKind(kind: ToolCallKind): string {
		// Remove the prefix (fs/, terminal/) for cleaner display
		const parts = kind.split('/');
		return parts.length > 1 ? parts[1] : kind;
	}

	private async executeReadTextFile(toolCall: ToolCall): Promise<ToolResult> {
		const { path } = toolCall.input as { path: string };
		const content = await this.fileSystemHandler.readTextFile(path);
		return {
			toolCallId: toolCall.id,
			content,
		};
	}

	private async executeWriteTextFile(toolCall: ToolCall): Promise<ToolResult> {
		const { path, content } = toolCall.input as { path: string; content: string };
		await this.fileSystemHandler.writeTextFile(path, content);
		return {
			toolCallId: toolCall.id,
			content: 'File written successfully',
		};
	}

	private async executeTerminalCreate(toolCall: ToolCall): Promise<ToolResult> {
		const { name } = toolCall.input as { name?: string };
		const terminalId = await this.terminalManager.createTerminal(name);
		return {
			toolCallId: toolCall.id,
			content: JSON.stringify({ terminalId }),
		};
	}

	private async executeTerminalSendInput(toolCall: ToolCall): Promise<ToolResult> {
		const { terminalId, input } = toolCall.input as { terminalId: string; input: string };
		await this.terminalManager.sendInput(terminalId, input);
		return {
			toolCallId: toolCall.id,
			content: 'Input sent to terminal',
		};
	}

	private async executeTerminalKill(toolCall: ToolCall): Promise<ToolResult> {
		const { terminalId } = toolCall.input as { terminalId: string };
		await this.terminalManager.killTerminal(terminalId);
		return {
			toolCallId: toolCall.id,
			content: 'Terminal killed',
		};
	}

    private async executeTerminalGetOutput(toolCall: ToolCall): Promise<ToolResult> {
        const { terminalId } = toolCall.input as { terminalId: string };
        const output = this.terminalManager.getOutput(terminalId);
        return {
            toolCallId: toolCall.id,
            content: output,
        };
    }

    /**
     * Approve a tool call (compatibility method for UI)
     */
    async approveTool(toolCallId: string): Promise<void> {
        // This is a stub for compatibility with the chat UI
        // In a full implementation, this would approve a pending tool call
    }

    /**
     * Reject a tool call (compatibility method for UI)
     */
    async rejectTool(toolCallId: string): Promise<void> {
        // This is a stub for compatibility with the chat UI
        // In a full implementation, this would reject a pending tool call
    }
}

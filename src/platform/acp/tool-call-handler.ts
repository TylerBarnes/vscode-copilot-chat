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
                        error: `Unknown tool kind: ${toolCall.kind}`,
                        content: [],
                    };
            }
        } catch (error) {
            return {
                toolCallId: toolCall.id,
                error: error instanceof Error ? error.message : String(error),
                content: [],
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
        const result = await this.fileSystemHandler.readTextFile({ path });
        return {
            toolCallId: toolCall.id,
            content: [{ type: 'text', text: result.content }],
        };
    }

    private async executeWriteTextFile(toolCall: ToolCall): Promise<ToolResult> {
        const { path, content } = toolCall.input as { path: string; content: string };
        await this.fileSystemHandler.writeTextFile({ path, content });
        return {
            toolCallId: toolCall.id,
            content: [{ type: 'text', text: 'File written successfully' }],
        };
    }

    private async executeTerminalCreate(toolCall: ToolCall): Promise<ToolResult> {
        const { command, args, env, cwd } = toolCall.input as { command: string; args?: string[]; env?: Record<string, string>; cwd?: string };
        const result = await this.terminalManager.createTerminal({ command, args, env, cwd });
        return {
            toolCallId: toolCall.id,
            content: [{ type: 'text', text: JSON.stringify(result) }],
        };
    }

    private async executeTerminalSendInput(toolCall: ToolCall): Promise<ToolResult> {
        // Terminal send input is not supported by the current TerminalManager
        // The terminal is created with a command and runs to completion
        return {
            toolCallId: toolCall.id,
            error: 'Terminal send input is not supported. Create a new terminal with the desired command instead.',
            content: [],
        };
    }

    private async executeTerminalKill(toolCall: ToolCall): Promise<ToolResult> {
        const { terminalId } = toolCall.input as { terminalId: string };
        await this.terminalManager.killTerminal({ terminalId });
        return {
            toolCallId: toolCall.id,
            content: [{ type: 'text', text: 'Terminal killed' }],
        };
    }

    private async executeTerminalGetOutput(toolCall: ToolCall): Promise<ToolResult> {
        const { terminalId } = toolCall.input as { terminalId: string };
        const output = this.terminalManager.getOutput(terminalId);
        return {
            toolCallId: toolCall.id,
            content: [{ type: 'text', text: output }],
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

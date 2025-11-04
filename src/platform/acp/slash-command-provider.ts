import * as vscode from 'vscode';
import type { SlashCommand } from './types';

/**
 * Provides slash command completions for the chat interface
 * 
 * This class manages available slash commands from the ACP agent
 * and provides VS Code completion items when the user types "/" in the chat.
 */
export class SlashCommandProvider {
    private availableCommands: SlashCommand[] = [];

    /**
     * Update the list of available slash commands
     * @param commands Array of slash commands from the agent
     */
    updateAvailableCommands(commands: SlashCommand[]): void {
        this.availableCommands = commands;
    }

    /**
     * Get all available slash commands
     * @returns Array of slash commands
     */
    getAvailableCommands(): SlashCommand[] {
        return this.availableCommands;
    }

    /**
     * Check if a command exists
     * @param name Command name (without the leading /)
     * @returns True if the command exists
     */
    hasCommand(name: string): boolean {
        return this.availableCommands.some(cmd => cmd.name === name);
    }

    /**
     * Get a specific command by name
     * @param name Command name (without the leading /)
     * @returns The command if found, undefined otherwise
     */
    getCommand(name: string): SlashCommand | undefined {
        return this.availableCommands.find(cmd => cmd.name === name);
    }

    /**
     * Provide completion items for slash commands
     * @param document The text document
     * @param position The cursor position
     * @returns Array of completion items
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        // Only provide completions if line starts with /
        if (!linePrefix.startsWith('/')) {
            return [];
        }

        return this.availableCommands.map(cmd => {
            const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
            item.detail = cmd.description;
            item.insertText = cmd.name;

            if (cmd.input?.hint) {
                item.documentation = new vscode.MarkdownString(cmd.input.hint);
            }

            return item;
        });
    }
}

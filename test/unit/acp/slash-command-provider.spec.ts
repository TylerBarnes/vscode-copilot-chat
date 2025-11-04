import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';

vi.mock('vscode', () => ({
    CompletionItem: class {
        label: string;
        kind: number;
        detail?: string;
        documentation?: any;
        insertText?: string;
        constructor(label: string, kind: number) {
            this.label = label;
            this.kind = kind;
        }
    },
    CompletionItemKind: {
        Function: 1,
    },
    MarkdownString: class {
        value: string;
        constructor(value: string) {
            this.value = value;
        }
    },
}));

import { SlashCommandProvider } from '../../../src/platform/acp/slash-command-provider';
import type { SlashCommand } from '../../../src/platform/acp/types';

describe('SlashCommandProvider', () => {
    let provider: SlashCommandProvider;

    beforeEach(() => {
        provider = new SlashCommandProvider();
    });

    describe('updateAvailableCommands', () => {
        it('should update available commands', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
                { name: 'help', description: 'Show help' },
            ];

            provider.updateAvailableCommands(commands);

            expect(provider.getAvailableCommands()).toEqual(commands);
        });

        it('should replace existing commands', () => {
            const commands1: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];
            const commands2: SlashCommand[] = [
                { name: 'help', description: 'Show help' },
            ];

            provider.updateAvailableCommands(commands1);
            provider.updateAvailableCommands(commands2);

            expect(provider.getAvailableCommands()).toEqual(commands2);
        });

        it('should handle empty commands array', () => {
            provider.updateAvailableCommands([
                { name: 'test', description: 'Test command' },
            ]);
            provider.updateAvailableCommands([]);

            expect(provider.getAvailableCommands()).toEqual([]);
        });
    });

    describe('provideCompletionItems', () => {
        beforeEach(() => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
                { name: 'help', description: 'Show help' },
                {
                    name: 'search',
                    description: 'Search files',
                    input: { hint: 'Enter search query', required: true },
                },
            ];
            provider.updateAvailableCommands(commands);
        });

        it('should provide completions when line starts with /', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/' }),
            } as any;
            const mockPosition = { character: 1 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toHaveLength(3);
            expect(items[0].label).toBe('test');
            expect(items[1].label).toBe('help');
            expect(items[2].label).toBe('search');
        });

        it('should not provide completions when line does not start with /', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: 'hello' }),
            } as any;
            const mockPosition = { character: 5 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toEqual([]);
        });

        it('should provide completions when typing after /', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/te' }),
            } as any;
            const mockPosition = { character: 3 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toHaveLength(3);
        });

        it('should set completion item properties correctly', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/' }),
            } as any;
            const mockPosition = { character: 1 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            const testItem = items[0];
            expect(testItem.label).toBe('test');
            expect(testItem.detail).toBe('Test command');
            expect(testItem.insertText).toBe('test');
            expect(testItem.kind).toBe(vscode.CompletionItemKind.Function);
        });

        it('should include documentation for commands with input hints', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/' }),
            } as any;
            const mockPosition = { character: 1 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            const searchItem = items.find(item => item.label === 'search');
            expect(searchItem).toBeDefined();
            expect(searchItem!.documentation).toBeDefined();
            expect((searchItem!.documentation as any).value).toBe('Enter search query');
        });

        it('should not include documentation for commands without input hints', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/' }),
            } as any;
            const mockPosition = { character: 1 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            const testItem = items.find(item => item.label === 'test');
            expect(testItem).toBeDefined();
            expect(testItem!.documentation).toBeUndefined();
        });

        it('should return empty array when no commands are available', () => {
            provider.updateAvailableCommands([]);

            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/' }),
            } as any;
            const mockPosition = { character: 1 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toEqual([]);
        });

        it('should handle position at start of line', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/test' }),
            } as any;
            const mockPosition = { character: 0 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toEqual([]);
        });

        it('should handle multi-line documents', () => {
            const mockDocument = {
                lineAt: vi.fn().mockReturnValue({ text: '/help' }),
            } as any;
            const mockPosition = { character: 5 } as any;

            const items = provider.provideCompletionItems(mockDocument, mockPosition);

            expect(items).toHaveLength(3);
        });
    });

    describe('getAvailableCommands', () => {
        it('should return empty array initially', () => {
            expect(provider.getAvailableCommands()).toEqual([]);
        });

        it('should return current commands', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];

            provider.updateAvailableCommands(commands);

            expect(provider.getAvailableCommands()).toEqual(commands);
        });
    });

    describe('hasCommand', () => {
        it('should return false when command does not exist', () => {
            expect(provider.hasCommand('test')).toBe(false);
        });

        it('should return true when command exists', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];

            provider.updateAvailableCommands(commands);

            expect(provider.hasCommand('test')).toBe(true);
        });

        it('should be case-sensitive', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];

            provider.updateAvailableCommands(commands);

            expect(provider.hasCommand('Test')).toBe(false);
            expect(provider.hasCommand('test')).toBe(true);
        });
    });

    describe('getCommand', () => {
        it('should return undefined when command does not exist', () => {
            expect(provider.getCommand('test')).toBeUndefined();
        });

        it('should return command when it exists', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];

            provider.updateAvailableCommands(commands);

            const command = provider.getCommand('test');
            expect(command).toEqual({ name: 'test', description: 'Test command' });
        });

        it('should be case-sensitive', () => {
            const commands: SlashCommand[] = [
                { name: 'test', description: 'Test command' },
            ];

            provider.updateAvailableCommands(commands);

            expect(provider.getCommand('Test')).toBeUndefined();
            expect(provider.getCommand('test')).toBeDefined();
        });
    });
});

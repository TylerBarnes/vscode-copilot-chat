import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentBlockMapper } from '../../../src/platform/acp/content-block-mapper';
import type * as vscode from 'vscode';
import { ContentBlock } from '../../../src/platform/acp/types';

// Mock vscode module
const mockVscode = vi.hoisted(() => ({
    Uri: {
        parse: vi.fn((uri: string) => ({ 
            toString: () => uri, 
            fsPath: uri,
            scheme: uri.startsWith('file://') ? 'file' : 'http',
        })),
    },
    MarkdownString: vi.fn((value: string) => ({ 
        value, 
        isTrusted: false,
        supportHtml: false,
    })),
}));

vi.mock('vscode', () => mockVscode);

describe('ContentBlockMapper', () => {
    let mapper: ContentBlockMapper;

    beforeEach(() => {
        mapper = new ContentBlockMapper();
        vi.clearAllMocks();
    });

    describe('mapContentBlock', () => {
        it('should map text content block to markdown string', () => {
            const block: ContentBlock = {
                type: 'text',
                text: 'Hello, world!',
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('markdown');
            expect(result.value).toBe('Hello, world!');
        });

        it('should map thinking content block to progress message', () => {
            const block: ContentBlock = {
                type: 'thinking',
                thinking: 'Analyzing the code...',
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('progress');
            expect(result.value).toBe('💭 Analyzing the code...');
        });

        it('should map image content block to markdown with base64 data', () => {
            const block: ContentBlock = {
                type: 'image',
                data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                mimeType: 'image/png',
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('markdown');
            expect(result.value).toContain('![Image](data:image/png;base64,');
            expect(result.value).toContain(block.data);
        });

        it('should map embedded resource (file) to reference', () => {
            const block: ContentBlock = {
                type: 'embedded_resource',
                resource: {
                    type: 'file',
                    uri: 'file:///path/to/file.ts',
                },
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('reference');
            expect(result.uri).toBeDefined();
            expect(result.uri?.toString()).toBe('file:///path/to/file.ts');
        });

        it('should map embedded resource (directory) to reference', () => {
            const block: ContentBlock = {
                type: 'embedded_resource',
                resource: {
                    type: 'directory',
                    uri: 'file:///path/to/dir',
                },
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('reference');
            expect(result.uri).toBeDefined();
            expect(result.uri?.toString()).toBe('file:///path/to/dir');
        });

        it('should handle unknown content block type', () => {
            const block: any = {
                type: 'unknown',
                data: 'some data',
            };

            const result = mapper.mapContentBlock(block);

            expect(result.type).toBe('markdown');
            expect(result.value).toContain('Unknown content type');
        });
    });

    describe('mapContentBlocks', () => {
        it('should map multiple content blocks', () => {
            const blocks: ContentBlock[] = [
                { type: 'text', text: 'First block' },
                { type: 'thinking', thinking: 'Processing...' },
                { type: 'text', text: 'Second block' },
            ];

            const results = mapper.mapContentBlocks(blocks);

            expect(results).toHaveLength(3);
            expect(results[0].type).toBe('markdown');
            expect(results[0].value).toBe('First block');
            expect(results[1].type).toBe('progress');
            expect(results[1].value).toBe('💭 Processing...');
            expect(results[2].type).toBe('markdown');
            expect(results[2].value).toBe('Second block');
        });

        it('should handle empty array', () => {
            const results = mapper.mapContentBlocks([]);
            expect(results).toHaveLength(0);
        });

        it('should filter out null results', () => {
            const blocks: ContentBlock[] = [
                { type: 'text', text: 'Valid block' },
                { type: 'unknown' as any, data: 'invalid' },
            ];

            const results = mapper.mapContentBlocks(blocks);

            // Should have 2 results (text + unknown fallback)
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('mapToMarkdown', () => {
        it('should convert text content to markdown', () => {
            const markdown = mapper.mapToMarkdown('Hello, **world**!');

            expect(markdown).toBeDefined();
            expect(markdown.value).toBe('Hello, **world**!');
        });

        it('should handle empty text', () => {
            const markdown = mapper.mapToMarkdown('');

            expect(markdown).toBeDefined();
            expect(markdown.value).toBe('');
        });
    });

    describe('mapToProgress', () => {
        it('should convert text to progress message', () => {
            const progress = mapper.mapToProgress('Loading data...');

            expect(progress).toBeDefined();
            expect(progress.type).toBe('progress');
            expect(progress.value).toBe('Loading data...');
        });

        it('should handle empty text', () => {
            const progress = mapper.mapToProgress('');

            expect(progress).toBeDefined();
            expect(progress.value).toBe('');
        });
    });

    describe('mapToReference', () => {
        it('should convert URI string to reference', () => {
            const reference = mapper.mapToReference('file:///path/to/file.ts');

            expect(reference).toBeDefined();
            expect(reference.type).toBe('reference');
            expect(reference.uri).toBeDefined();
            expect(reference.uri?.toString()).toBe('file:///path/to/file.ts');
        });

        it('should handle http URIs', () => {
            const reference = mapper.mapToReference('https://example.com/file.ts');

            expect(reference).toBeDefined();
            expect(reference.uri).toBeDefined();
            expect(reference.uri?.toString()).toBe('https://example.com/file.ts');
        });
    });
});

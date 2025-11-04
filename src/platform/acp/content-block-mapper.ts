import * as vscode from 'vscode';
import { ContentBlock } from './types';

/**
 * Result of mapping a content block
 */
export interface MappedContent {
    type: 'markdown' | 'progress' | 'reference';
    value?: string;
    uri?: vscode.Uri;
}

/**
 * Maps ACP content blocks to VS Code chat UI format
 */
export class ContentBlockMapper {
    /**
     * Map a single content block to VS Code format
     */
    mapContentBlock(block: ContentBlock): MappedContent {
        switch (block.type) {
            case 'text':
                return {
                    type: 'markdown',
                    value: block.text,
                };

            case 'thinking':
                return {
                    type: 'progress',
                    value: `💭 ${block.thinking}`,
                };

            case 'image':
                return {
                    type: 'markdown',
                    value: `![Image](data:${block.mimeType};base64,${block.data})`,
                };

            case 'embedded_resource':
                return {
                    type: 'reference',
                    uri: vscode.Uri.parse(block.resource.uri),
                };

            default:
                // Fallback for unknown types
                return {
                    type: 'markdown',
                    value: `Unknown content type: ${(block as any).type}`,
                };
        }
    }

    /**
     * Map multiple content blocks to VS Code format
     */
    mapContentBlocks(blocks: ContentBlock[]): MappedContent[] {
        return blocks
            .map(block => this.mapContentBlock(block))
            .filter(result => result !== null);
    }

    /**
     * Convert text to markdown format
     */
    mapToMarkdown(text: string): MappedContent {
        return {
            type: 'markdown',
            value: text,
        };
    }

    /**
     * Convert text to progress message
     */
    mapToProgress(text: string): MappedContent {
        return {
            type: 'progress',
            value: text,
        };
    }

    /**
     * Convert URI to reference
     */
    mapToReference(uri: string): MappedContent {
        return {
            type: 'reference',
            uri: vscode.Uri.parse(uri),
        };
    }
}

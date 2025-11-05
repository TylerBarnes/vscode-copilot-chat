import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThinkingStepsDisplay } from '../../../src/platform/acp/thinking-steps-display';
import type { ThinkingContent } from '../../../src/platform/acp/types';

// Mock vscode module
vi.mock('vscode', () => ({
    ChatResponseMarkdownPart: class {
        constructor(public value: string) {}
    },
}));

describe('ThinkingStepsDisplay', () => {
    let display: ThinkingStepsDisplay;
    let mockStream: {
        markdown: ReturnType<typeof vi.fn>;
        button: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockStream = {
            markdown: vi.fn(),
            button: vi.fn(),
        };
        display = new ThinkingStepsDisplay();
    });

    describe('displayThinking', () => {
        it('should display a single thinking step', () => {
            const thinking: ThinkingContent = {
                type: 'thinking',
                thinking: 'Analyzing the user request...',
            };

            display.displayThinking(thinking, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('💭 Agent Thinking');
            expect(markdown).toContain('Analyzing the user request...');
        });

        it('should accumulate multiple thinking steps', () => {
            const thinking1: ThinkingContent = {
                type: 'thinking',
                thinking: 'Step 1: Understanding the problem',
            };
            const thinking2: ThinkingContent = {
                type: 'thinking',
                thinking: 'Step 2: Planning the solution',
            };

            display.displayThinking(thinking1, mockStream as any);
            mockStream.markdown.mockClear();
            display.displayThinking(thinking2, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('Step 1: Understanding the problem');
            expect(markdown).toContain('Step 2: Planning the solution');
        });

        it('should format thinking steps as collapsible section', () => {
            const thinking: ThinkingContent = {
                type: 'thinking',
                thinking: 'Analyzing code structure',
            };

            display.displayThinking(thinking, mockStream as any);

            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('<details>');
            expect(markdown).toContain('<summary>');
            expect(markdown).toContain('</details>');
        });

        it('should show step count in summary', () => {
            const steps = [
                'Understanding the request',
                'Analyzing the code',
                'Planning the changes',
            ];

            for (const step of steps) {
                display.displayThinking({ type: 'thinking', thinking: step }, mockStream as any);
                mockStream.markdown.mockClear();
            }

            // Display final state
            display.displayThinking({ type: 'thinking', thinking: 'Final step' }, mockStream as any);

            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('(4 steps)');
        });

        it('should handle empty thinking content', () => {
            const thinking: ThinkingContent = {
                type: 'thinking',
                thinking: '',
            };

            display.displayThinking(thinking, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('💭 Agent Thinking');
        });

        it('should handle multiline thinking content', () => {
            const thinking: ThinkingContent = {
                type: 'thinking',
                thinking: `First line of thought
Second line of thought
Third line of thought`,
            };

            display.displayThinking(thinking, mockStream as any);

            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('First line of thought');
            expect(markdown).toContain('Second line of thought');
            expect(markdown).toContain('Third line of thought');
        });
    });

    describe('formatThinkingMarkdown', () => {
        it('should format thinking steps as markdown', () => {
            display.addStep('Step 1');
            display.addStep('Step 2');

            const markdown = display.formatThinkingMarkdown();

            expect(markdown).toContain('💭 Agent Thinking');
            expect(markdown).toContain('Step 1');
            expect(markdown).toContain('Step 2');
            expect(markdown).toContain('<details>');
        });

        it('should include timestamp for each step', () => {
            display.addStep('Step with timestamp');

            const markdown = display.formatThinkingMarkdown();

            // Should include some time indicator (bullet point or number)
            expect(markdown).toMatch(/[•▸>]|^\d+\./m);
            expect(markdown).toContain('Step with timestamp');
        });

        it('should handle special characters in thinking content', () => {
            display.addStep('Thinking about <code> and & symbols');

            const markdown = display.formatThinkingMarkdown();

            expect(markdown).toContain('Thinking about <code> and & symbols');
        });
    });

    describe('addStep', () => {
        it('should add a new thinking step', () => {
            display.addStep('New thinking step');

            const steps = display.getSteps();
            expect(steps).toHaveLength(1);
            expect(steps[0]).toBe('New thinking step');
        });

        it('should maintain order of steps', () => {
            display.addStep('First');
            display.addStep('Second');
            display.addStep('Third');

            const steps = display.getSteps();
            expect(steps).toEqual(['First', 'Second', 'Third']);
        });

        it('should trim whitespace from steps', () => {
            display.addStep('  Trimmed step  ');

            const steps = display.getSteps();
            expect(steps[0]).toBe('Trimmed step');
        });

        it('should ignore empty steps', () => {
            display.addStep('');
            display.addStep('   ');

            const steps = display.getSteps();
            expect(steps).toHaveLength(0);
        });
    });

    describe('getSteps', () => {
        it('should return all accumulated steps', () => {
            display.addStep('Step 1');
            display.addStep('Step 2');
            display.addStep('Step 3');

            const steps = display.getSteps();

            expect(steps).toHaveLength(3);
            expect(steps).toEqual(['Step 1', 'Step 2', 'Step 3']);
        });

        it('should return empty array when no steps', () => {
            const steps = display.getSteps();
            expect(steps).toEqual([]);
        });

        it('should return a copy of steps array', () => {
            display.addStep('Step 1');
            
            const steps1 = display.getSteps();
            const steps2 = display.getSteps();
            
            expect(steps1).not.toBe(steps2); // Different array instances
            expect(steps1).toEqual(steps2); // Same content
        });
    });

    describe('clear', () => {
        it('should clear all thinking steps', () => {
            display.addStep('Step 1');
            display.addStep('Step 2');
            
            display.clear();
            
            const steps = display.getSteps();
            expect(steps).toHaveLength(0);
        });

        it('should allow adding new steps after clear', () => {
            display.addStep('Old step');
            display.clear();
            display.addStep('New step');

            const steps = display.getSteps();
            expect(steps).toEqual(['New step']);
        });
    });

    describe('isCollapsed', () => {
        it('should default to collapsed state', () => {
            expect(display.isCollapsed()).toBe(true);
        });

        it('should toggle collapsed state', () => {
            display.toggleCollapsed();
            expect(display.isCollapsed()).toBe(false);
            
            display.toggleCollapsed();
            expect(display.isCollapsed()).toBe(true);
        });

        it('should affect markdown formatting', () => {
            display.addStep('Step 1');
            
            // Collapsed
            let markdown = display.formatThinkingMarkdown();
            expect(markdown).toContain('<details>');
            
            // Expanded
            display.toggleCollapsed();
            markdown = display.formatThinkingMarkdown();
            expect(markdown).toContain('<details open>');
        });
    });
});
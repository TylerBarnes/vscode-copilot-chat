import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentPlanViewer } from '../../../src/platform/acp/agent-plan-viewer';
import type { AgentPlan } from '../../../src/platform/acp/types';

// Mock vscode module
vi.mock('vscode', () => ({
    ChatResponseMarkdownPart: class {
        constructor(public value: string) {}
    },
}));

describe('AgentPlanViewer', () => {
    let viewer: AgentPlanViewer;
    let mockStream: {
        markdown: ReturnType<typeof vi.fn>;
        button: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockStream = {
            markdown: vi.fn(),
            button: vi.fn(),
        };
        viewer = new AgentPlanViewer();
    });

    describe('displayPlan', () => {
        it('should display a simple plan with pending steps', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'pending' },
                    { description: 'Analyze code', status: 'pending' },
                ],
            };

            viewer.displayPlan(plan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('🎯 Agent Plan:');
            expect(markdown).toContain('⏸️ Read file');
            expect(markdown).toContain('⏸️ Analyze code');
        });

        it('should display plan with mixed status steps', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                    { description: 'Write changes', status: 'pending' },
                ],
            };

            viewer.displayPlan(plan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('✓ Read file');
            expect(markdown).toContain('⏳ Analyze code');
            expect(markdown).toContain('⏸️ Write changes');
        });

        it('should display plan with failed step', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'failed' },
                ],
            };

            viewer.displayPlan(plan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('✓ Read file');
            expect(markdown).toContain('✗ Analyze code');
        });

        it('should handle empty plan', () => {
            const plan: AgentPlan = {
                steps: [],
            };

            viewer.displayPlan(plan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('🎯 Agent Plan:');
            expect(markdown).toContain('No steps defined');
        });

        it('should number steps sequentially', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Step one', status: 'completed' },
                    { description: 'Step two', status: 'in_progress' },
                    { description: 'Step three', status: 'pending' },
                ],
            };

            viewer.displayPlan(plan, mockStream as any);

            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('1. ✓ Step one');
            expect(markdown).toContain('2. ⏳ Step two');
            expect(markdown).toContain('3. ⏸️ Step three');
        });
    });

    describe('updatePlan', () => {
        it('should update existing plan with new status', () => {
            const initialPlan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'pending' },
                    { description: 'Analyze code', status: 'pending' },
                ],
            };

            viewer.displayPlan(initialPlan, mockStream as any);
            mockStream.markdown.mockClear();

            const updatedPlan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                ],
            };

            viewer.updatePlan(updatedPlan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('✓ Read file');
            expect(markdown).toContain('⏳ Analyze code');
        });

        it('should handle plan with added steps', () => {
            const initialPlan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                ],
            };

            viewer.displayPlan(initialPlan, mockStream as any);
            mockStream.markdown.mockClear();

            const updatedPlan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                    { description: 'Write changes', status: 'pending' },
                ],
            };

            viewer.updatePlan(updatedPlan, mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledOnce();
            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('1. ✓ Read file');
            expect(markdown).toContain('2. ⏳ Analyze code');
            expect(markdown).toContain('3. ⏸️ Write changes');
        });
    });

    describe('formatPlanMarkdown', () => {
        it('should format plan as markdown string', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                ],
            };

            const markdown = viewer.formatPlanMarkdown(plan);

            expect(markdown).toContain('🎯 Agent Plan:');
            expect(markdown).toContain('1. ✓ Read file');
            expect(markdown).toContain('2. ⏳ Analyze code');
        });

        it('should include completion summary', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'completed' },
                    { description: 'Write changes', status: 'completed' },
                ],
            };

            const markdown = viewer.formatPlanMarkdown(plan);

            expect(markdown).toContain('✅ Plan completed (3/3 steps)');
        });

        it('should show progress for partial completion', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'in_progress' },
                    { description: 'Write changes', status: 'pending' },
                ],
            };

            const markdown = viewer.formatPlanMarkdown(plan);

            expect(markdown).toContain('⏳ Progress: 1/3 steps completed');
        });

        it('should show failure status', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                    { description: 'Analyze code', status: 'failed' },
                    { description: 'Write changes', status: 'pending' },
                ],
            };

            const markdown = viewer.formatPlanMarkdown(plan);

            expect(markdown).toContain('❌ Plan failed at step 2');
        });
    });

    describe('getStepIcon', () => {
        it('should return correct icons for each status', () => {
            expect(viewer.getStepIcon('pending')).toBe('⏸️');
            expect(viewer.getStepIcon('in_progress')).toBe('⏳');
            expect(viewer.getStepIcon('completed')).toBe('✓');
            expect(viewer.getStepIcon('failed')).toBe('✗');
        });

        it('should return default icon for unknown status', () => {
            expect(viewer.getStepIcon('unknown' as any)).toBe('•');
        });
    });

    describe('clear', () => {
        it('should clear internal state', () => {
            const plan: AgentPlan = {
                steps: [
                    { description: 'Read file', status: 'completed' },
                ],
            };

            viewer.displayPlan(plan, mockStream as any);
            viewer.clear();

            // After clear, displaying a new plan should start fresh
            const newPlan: AgentPlan = {
                steps: [
                    { description: 'New step', status: 'pending' },
                ],
            };

            mockStream.markdown.mockClear();
            viewer.displayPlan(newPlan, mockStream as any);

            const markdown = mockStream.markdown.mock.calls[0][0];
            expect(markdown).toContain('⏸️ New step');
            expect(markdown).not.toContain('Read file');
        });
    });
});

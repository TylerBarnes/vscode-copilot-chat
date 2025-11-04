import * as vscode from 'vscode';

/**
 * Represents a single thinking step from the agent.
 */
export interface ThinkingStep {
    content: string;
    timestamp: number;
}

/**
 * Displays and manages the agent's thinking steps in the VS Code chat interface.
 * Shows the agent's reasoning process in a collapsible format.
 */
export class ThinkingStepsDisplay {
    private steps: ThinkingStep[] = [];
    private collapsed: boolean = true;

    /**
     * Display a thinking step in the chat stream.
     * @param content The thinking content to display (string or ThinkingContent object)
     * @param stream The chat response stream
     */
    displayThinking(content: string | { type: 'thinking'; content: string }, stream: vscode.ChatResponseStream): void {
        // Extract content string if ThinkingContent object is passed
        const contentStr = typeof content === 'string' ? content : content.content;
        this.addStep(contentStr);
        const markdown = this.formatThinkingMarkdown();
        stream.markdown(markdown);
    }

    /**
     * Format all thinking steps as markdown for display.
     */
    formatThinkingMarkdown(): string {
        const stepCount = this.steps.length > 0 ? ` (${this.steps.length} steps)` : '';
        const openAttr = this.collapsed ? '' : ' open';
        
        const lines: string[] = [
            `<details${openAttr}>`,
            `<summary>💭 Agent Thinking${stepCount}</summary>`,
            '',
        ];

        if (this.steps.length === 0) {
            lines.push('</details>');
            lines.push('');
            return lines.join('\n');
        }

        this.steps.forEach((step, index) => {
            lines.push(`${index + 1}. ${step.content}`);
        });
        
        lines.push('</details>');
        lines.push('');
        
        return lines.join('\n');
    }

    /**
     * Add a new thinking step.
     */
    addStep(content: string): void {
        const trimmed = content.trim();
        if (trimmed) {
            this.steps.push({
                content: trimmed,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Get all thinking steps.
     */
    getSteps(): string[] {
        return this.steps.map(step => step.content);
    }

    /**
     * Clear all thinking steps.
     */
    clear(): void {
        this.steps = [];
    }

    /**
     * Set whether the thinking steps should be displayed in collapsed format.
     */
    setCollapsed(collapsed: boolean): void {
        this.collapsed = collapsed;
    }

    /**
     * Check if the thinking steps are displayed in collapsed format.
     */
    isCollapsed(): boolean {
        return this.collapsed;
    }

    /**
     * Toggle the collapsed state.
     */
    toggleCollapsed(): void {
        this.collapsed = !this.collapsed;
    }
}

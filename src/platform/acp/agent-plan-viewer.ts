import * as vscode from 'vscode';
import type { AgentPlan, PlanUpdate } from './types';

/**
 * Displays and manages the agent's plan in the VS Code chat interface.
 * Shows plan steps with status indicators and updates them as the agent progresses.
 */
export class AgentPlanViewer {
    private currentPlan: AgentPlan | null = null;

    /**
     * Display a new agent plan in the chat stream.
     */
    displayPlan(plan: AgentPlan, stream: vscode.ChatResponseStream): void {
        this.currentPlan = plan;
        const markdown = this.formatPlanMarkdown(plan);
        stream.markdown(markdown);
    }

    /**
     * Update an existing plan with new status information.
     * Can accept either a PlanUpdate (single step) or a full AgentPlan.
     */
    updatePlan(update: PlanUpdate | AgentPlan, stream: vscode.ChatResponseStream): void {
        // Check if update is a full AgentPlan (has 'steps' property)
        if ('steps' in update) {
            // Full plan update - replace current plan
            this.currentPlan = update;
        } else {
            // Single step update
            if (!this.currentPlan) {
                // If no current plan, treat update as a new plan
                this.currentPlan = {
                    steps: [{
                        description: update.description || 'Plan step',
                        status: update.status || 'pending',
                    }],
                };
            } else {
                // Find and update the matching step
                const stepIndex = this.currentPlan.steps.findIndex(
                    step => step.description === update.description
                );

                if (stepIndex >= 0) {
                    // Update existing step
                    this.currentPlan.steps[stepIndex].status = update.status || 'pending';
                } else {
                    // Add new step
                    this.currentPlan.steps.push({
                        description: update.description || 'Plan step',
                        status: update.status || 'pending',
                    });
                }
            }
        }

        const markdown = this.formatPlanMarkdown(this.currentPlan);
        stream.markdown(markdown);
    }

    /**
     * Format the plan as markdown for display.
     */
    formatPlanMarkdown(plan: AgentPlan): string {
        const lines: string[] = [];
        
        lines.push('🎯 Agent Plan:');
        lines.push('');
        
        // Handle empty plan
        if (plan.steps.length === 0) {
            lines.push('No steps defined');
            return lines.join('\n') + '\n';
        }
        
        // Check for completion or failures
        const completedCount = plan.steps.filter(step => step.status === 'completed').length;
        const totalCount = plan.steps.length;
        const failedCount = plan.steps.filter(step => step.status === 'failed').length;
        const failedIndex = plan.steps.findIndex(step => step.status === 'failed');
        
        if (failedCount > 0) {
            lines.push(`❌ Plan failed at step ${failedIndex + 1}`);
            lines.push('');
        } else if (completedCount === totalCount && totalCount > 0) {
            lines.push(`✅ Plan completed (${totalCount}/${totalCount} steps)`);
            lines.push('');
        } else if (completedCount > 0) {
            lines.push(`⏳ Progress: ${completedCount}/${totalCount} steps completed`);
            lines.push('');
        }
        
        plan.steps.forEach((step, index) => {
            const icon = this.getStepIcon(step.status);
            lines.push(`${index + 1}. ${icon} ${step.description}`);
        });
        
        return lines.join('\n') + '\n';
    }

    /**
     * Get the appropriate icon for a plan step status.
     */
    getStepIcon(status: 'pending' | 'in_progress' | 'completed' | 'failed'): string {
        switch (status) {
            case 'pending':
                return '⏸️';
            case 'in_progress':
                return '⏳';
            case 'completed':
                return '✓';
            case 'failed':
                return '✗';
            default:
                return '•';
        }
    }

    /**
     * Get the current plan.
     */
    getCurrentPlan(): AgentPlan | null {
        return this.currentPlan;
    }

    /**
     * Clear the current plan.
     */
    clear(): void {
        this.currentPlan = null;
    }
}

import type { ToolCallKind } from './types';

export type PermissionDecision = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';

export interface PermissionRequest {
	toolCallId: string;
	title: string;
	kind: ToolCallKind;
	details?: Record<string, unknown>;
}

export interface PermissionRule {
	kind: ToolCallKind;
	decision: 'allow' | 'reject';
}

type PermissionCallback = (request: PermissionRequest) => Promise<PermissionDecision>;

/**
 * Handles permission requests from ACP agents.
 * 
 * Features:
 * - User permission prompts via callbacks
 * - Persistent rules (allow_always/reject_always)
 * - Auto-approval based on settings (e.g., auto-approve 'read' and 'think')
 * - Rule management (clear, remove specific rules)
 */
export class PermissionHandler {
	private callbacks: Set<PermissionCallback> = new Set();
	private rules: Map<ToolCallKind, 'allow' | 'reject'> = new Map();
	private autoApproveKinds: Set<ToolCallKind>;

	constructor(autoApproveKinds: ToolCallKind[] = []) {
		this.autoApproveKinds = new Set(autoApproveKinds);
	}

	/**
	 * Request permission for a tool call.
	 * 
	 * Decision flow:
	 * 1. Check if kind is in autoApproveKinds -> auto-approve
	 * 2. Check if a rule exists for this kind -> apply rule
	 * 3. Call registered callbacks to prompt user
	 * 4. If decision is allow_always/reject_always, store rule
	 */
	async requestPermission(
		toolCallId: string,
		title: string,
		kind: ToolCallKind,
		details?: Record<string, unknown>
	): Promise<PermissionDecision> {
		// 1. Auto-approve based on settings
		if (this.autoApproveKinds.has(kind)) {
			return 'allow_once';
		}

		// 2. Check existing rules
		const existingRule = this.rules.get(kind);
		if (existingRule === 'allow') {
			return 'allow_once';
		}
		if (existingRule === 'reject') {
			return 'reject_once';
		}

		// 3. Prompt user via callbacks
		if (this.callbacks.size === 0) {
			throw new Error('No permission callback registered');
		}

		const request: PermissionRequest = {
			toolCallId,
			title,
			kind,
			details
		};

		// Call all registered callbacks (first one wins, but all are notified)
		const decisions = await Promise.all(
			Array.from(this.callbacks).map(cb => cb(request))
		);
		const decision = decisions[0];

		// 4. Store rule if always decision
		if (decision === 'allow_always') {
			this.rules.set(kind, 'allow');
			return 'allow_always';
		}
		if (decision === 'reject_always') {
			this.rules.set(kind, 'reject');
			return 'reject_always';
		}

		return decision;
	}

	/**
	 * Register a callback to handle permission requests.
	 * Multiple callbacks can be registered (e.g., for UI and logging).
	 */
	onRequestPermission(callback: PermissionCallback): void {
		this.callbacks.add(callback);
	}

	/**
	 * Unregister a permission callback.
	 */
	offRequestPermission(callback: PermissionCallback): void {
		this.callbacks.delete(callback);
	}

	/**
	 * Clear all permission rules.
	 * Useful when starting a new session or resetting permissions.
	 */
	clearRules(): void {
		this.rules.clear();
	}

	/**
	 * Get all active permission rules.
	 */
	getRules(): PermissionRule[] {
		return Array.from(this.rules.entries()).map(([kind, decision]) => ({
			kind,
			decision
		}));
	}

	/**
	 * Remove a specific permission rule by kind.
	 */
	removeRule(kind: ToolCallKind): void {
		this.rules.delete(kind);
	}
}

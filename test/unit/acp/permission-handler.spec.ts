import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionHandler, PermissionDecision, PermissionRule } from '../../../src/platform/acp/permission-handler';
import type { ToolCallKind } from '../../../src/platform/acp/types';

describe('PermissionHandler', () => {
	let handler: PermissionHandler;

	beforeEach(() => {
		handler = new PermissionHandler();
	});

	describe('requestPermission', () => {
		it('should request permission with correct parameters', async () => {
			const mockCallback = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			const decision = await handler.requestPermission(
				'tool-123',
				'Read file',
				'read',
				{ path: '/workspace/file.txt' }
			);

			expect(mockCallback).toHaveBeenCalledWith({
				toolCallId: 'tool-123',
				title: 'Read file',
				kind: 'read',
				details: { path: '/workspace/file.txt' }
			});
			expect(decision).toBe('allow_once');
		});

		it('should handle allow_once decision', async () => {
			const mockCallback = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			const decision = await handler.requestPermission('tool-1', 'Test', 'read');
			expect(decision).toBe('allow_once');

			// Should not auto-approve next time
			const decision2 = await handler.requestPermission('tool-2', 'Test', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should handle allow_always decision and auto-approve future requests', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// First request - user chooses allow_always
			const decision1 = await handler.requestPermission('tool-1', 'Read file', 'read', { path: '/workspace/a.txt' });
			expect(decision1).toBe('allow_always');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Second request - should auto-approve without callback
			const decision2 = await handler.requestPermission('tool-2', 'Read file', 'read', { path: '/workspace/b.txt' });
			expect(decision2).toBe('allow_once'); // Auto-approved as allow_once
			expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should handle reject_once decision', async () => {
			const mockCallback = vi.fn().mockResolvedValue('reject_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			const decision = await handler.requestPermission('tool-1', 'Test', 'execute');
			expect(decision).toBe('reject_once');

			// Should still ask next time
			const decision2 = await handler.requestPermission('tool-2', 'Test', 'execute');
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should handle reject_always decision and auto-reject future requests', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('reject_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// First request - user chooses reject_always
			const decision1 = await handler.requestPermission('tool-1', 'Execute command', 'execute', { command: 'rm -rf /' });
			expect(decision1).toBe('reject_always');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Second request - should auto-reject without callback
			const decision2 = await handler.requestPermission('tool-2', 'Execute command', 'execute', { command: 'dangerous' });
			expect(decision2).toBe('reject_once'); // Auto-rejected as reject_once
			expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should match rules by kind only', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read file A', 'read', { path: '/a.txt' });
			
			// Different title and details, but same kind - should auto-approve
			const decision = await handler.requestPermission('tool-2', 'Read file B', 'read', { path: '/b.txt' });
			expect(decision).toBe('allow_once');
			expect(mockCallback).toHaveBeenCalledTimes(1);
		});

		it('should handle different kinds separately', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Allow all reads
			await handler.requestPermission('tool-1', 'Read', 'read');
			
			// Reject all executes
			await handler.requestPermission('tool-2', 'Execute', 'execute');

			// Verify rules are applied independently
			const readDecision = await handler.requestPermission('tool-3', 'Read', 'read');
			expect(readDecision).toBe('allow_once');

			const executeDecision = await handler.requestPermission('tool-4', 'Execute', 'execute');
			expect(executeDecision).toBe('reject_once');

			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should throw if no callback is registered', async () => {
			await expect(
				handler.requestPermission('tool-1', 'Test', 'read')
			).rejects.toThrow('No permission callback registered');
		});

		it('should support multiple callbacks', async () => {
			const callback1 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			const callback2 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);

			handler.onRequestPermission(callback1);
			handler.onRequestPermission(callback2);

			await handler.requestPermission('tool-1', 'Test', 'read');

			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});
	});

	describe('clearRules', () => {
		it('should clear all permission rules', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Set up a rule
			await handler.requestPermission('tool-1', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Verify rule is active
			await handler.requestPermission('tool-2', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(1); // Still 1, auto-approved

			// Clear rules
			handler.clearRules();

			// Should ask again
			await handler.requestPermission('tool-3', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});
	});

	describe('getRules', () => {
		it('should return all active rules', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read', 'read');
			await handler.requestPermission('tool-2', 'Execute', 'execute');

			const rules = handler.getRules();
			expect(rules).toHaveLength(2);
			expect(rules).toContainEqual({ kind: 'read', decision: 'allow' });
			expect(rules).toContainEqual({ kind: 'execute', decision: 'reject' });
		});

		it('should return empty array when no rules exist', () => {
			const rules = handler.getRules();
			expect(rules).toEqual([]);
		});
	});

	describe('removeRule', () => {
		it('should remove a specific rule by kind', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Set up a rule
			await handler.requestPermission('tool-1', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Remove the rule
			handler.removeRule('read');

			// Should ask again
			await handler.requestPermission('tool-2', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should not affect other rules', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Set up two rules
			await handler.requestPermission('tool-1', 'Read', 'read');
			await handler.requestPermission('tool-2', 'Execute', 'execute');

			// Remove read rule
			handler.removeRule('read');

			// Read should ask again
			await handler.requestPermission('tool-3', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalledTimes(3);

			// Execute should still auto-reject
			const decision = await handler.requestPermission('tool-4', 'Execute', 'execute');
			expect(decision).toBe('reject_once');
			expect(mockCallback).toHaveBeenCalledTimes(3); // Not called again
		});
	});

	describe('offRequestPermission', () => {
		it('should remove a specific callback', async () => {
			const callback1 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			const callback2 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);

			handler.onRequestPermission(callback1);
			handler.onRequestPermission(callback2);

			handler.offRequestPermission(callback1);

			await handler.requestPermission('tool-1', 'Test', 'read');

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});
	});

	describe('auto-approval from settings', () => {
		it('should auto-approve based on autoApproveKinds', async () => {
			const mockCallback = vi.fn();
			handler = new PermissionHandler(['read', 'think']);
			handler.onRequestPermission(mockCallback);

			// Read should auto-approve
			const readDecision = await handler.requestPermission('tool-1', 'Read', 'read');
			expect(readDecision).toBe('allow_once');
			expect(mockCallback).not.toHaveBeenCalled();

			// Think should auto-approve
			const thinkDecision = await handler.requestPermission('tool-2', 'Think', 'think');
			expect(thinkDecision).toBe('allow_once');
			expect(mockCallback).not.toHaveBeenCalled();

			// Execute should ask
			mockCallback.mockResolvedValue('allow_once' as PermissionDecision);
			const executeDecision = await handler.requestPermission('tool-3', 'Execute', 'execute');
			expect(executeDecision).toBe('allow_once');
			expect(mockCallback).toHaveBeenCalledTimes(1);
		});

		it('should handle empty autoApproveKinds', async () => {
			const mockCallback = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			handler = new PermissionHandler([]);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read', 'read');
			expect(mockCallback).toHaveBeenCalled();
		});
	});
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionHandler, PermissionDecision } from '../../../src/platform/acp/permission-handler';
import { ToolCallKind } from '../../../src/platform/acp/types';

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
				ToolCallKind.Read,
				{ path: '/workspace/file.txt' }
			);

			expect(mockCallback).toHaveBeenCalledWith({
				toolCallId: 'tool-123',
				title: 'Read file',
				kind: ToolCallKind.Read,
				details: { path: '/workspace/file.txt' }
			});
			expect(decision).toBe('allow_once');
		});

		it('should handle allow_once decision', async () => {
			const mockCallback = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			const decision = await handler.requestPermission('tool-1', 'Test', ToolCallKind.Read);
			expect(decision).toBe('allow_once');

            // Should not auto-approve next time
            await handler.requestPermission('tool-2', 'Test', ToolCallKind.Read);
            expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should handle allow_always decision and auto-approve future requests', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// First request - user chooses allow_always
			const decision1 = await handler.requestPermission('tool-1', 'Read file', ToolCallKind.Read, { path: '/workspace/a.txt' });
			expect(decision1).toBe('allow_always');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Second request - should auto-approve without callback
			const decision2 = await handler.requestPermission('tool-2', 'Read file', ToolCallKind.Read, { path: '/workspace/b.txt' });
			expect(decision2).toBe('allow_once'); // Auto-approved as allow_once
			expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should handle reject_once decision', async () => {
			const mockCallback = vi.fn().mockResolvedValue('reject_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			const decision = await handler.requestPermission('tool-1', 'Test', ToolCallKind.Execute);
			expect(decision).toBe('reject_once');

            // Should still ask next time
            await handler.requestPermission('tool-2', 'Test', ToolCallKind.Execute);
            expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should handle reject_always decision and auto-reject future requests', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('reject_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// First request - user chooses reject_always
			const decision1 = await handler.requestPermission('tool-1', 'Execute command', ToolCallKind.Execute, { command: 'rm -rf /' });
			expect(decision1).toBe('reject_always');
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Second request - should auto-reject without callback
			const decision2 = await handler.requestPermission('tool-2', 'Execute command', ToolCallKind.Execute, { command: 'dangerous' });
			expect(decision2).toBe('reject_once'); // Auto-rejected as reject_once
			expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should match rules by kind only', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read file A', ToolCallKind.Read, { path: '/a.txt' });
			
			// Different title and details, but same kind - should auto-approve
			const decision = await handler.requestPermission('tool-2', 'Read file B', ToolCallKind.Read, { path: '/b.txt' });
			expect(decision).toBe('allow_once');
			expect(mockCallback).toHaveBeenCalledTimes(1);
		});

		it('should handle different kinds separately', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Allow all reads
			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			
			// Reject all executes
			await handler.requestPermission('tool-2', 'Execute', ToolCallKind.Execute);

			// Verify rules are applied independently
			const readDecision = await handler.requestPermission('tool-3', 'Read', ToolCallKind.Read);
			expect(readDecision).toBe('allow_once');

			const executeDecision = await handler.requestPermission('tool-4', 'Execute', ToolCallKind.Execute);
			expect(executeDecision).toBe('reject_once');

			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should throw if no callback is registered', async () => {
			await expect(
				handler.requestPermission('tool-1', 'Test', ToolCallKind.Read)
			).rejects.toThrow('No permission callback registered');
		});

		it('should support multiple callbacks', async () => {
			const callback1 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			const callback2 = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);

			handler.onRequestPermission(callback1);
			handler.onRequestPermission(callback2);

			await handler.requestPermission('tool-1', 'Test', ToolCallKind.Read);

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
			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Verify rule is active
			await handler.requestPermission('tool-2', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(1); // Still 1, auto-approved

			// Clear rules
			handler.clearRules();

			// Should ask again
			await handler.requestPermission('tool-3', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});
	});

	describe('getRules', () => {
		it('should return all active rules', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			await handler.requestPermission('tool-2', 'Execute', ToolCallKind.Execute);

			const rules = handler.getRules();
			expect(rules).toHaveLength(2);
			expect(rules).toContainEqual({ kind: ToolCallKind.Read, decision: 'allow' });
			expect(rules).toContainEqual({ kind: ToolCallKind.Execute, decision: 'reject' });
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
			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(1);

			// Remove the rule
			handler.removeRule(ToolCallKind.Read);

			// Should ask again
			await handler.requestPermission('tool-2', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(2);
		});

		it('should not affect other rules', async () => {
			const mockCallback = vi.fn()
				.mockResolvedValueOnce('allow_always' as PermissionDecision)
				.mockResolvedValueOnce('reject_always' as PermissionDecision)
				.mockResolvedValueOnce('allow_once' as PermissionDecision);
			handler.onRequestPermission(mockCallback);

			// Set up two rules
			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			await handler.requestPermission('tool-2', 'Execute', ToolCallKind.Execute);

			// Remove read rule
			handler.removeRule(ToolCallKind.Read);

			// Read should ask again
			await handler.requestPermission('tool-3', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalledTimes(3);

			// Execute should still auto-reject
			const decision = await handler.requestPermission('tool-4', 'Execute', ToolCallKind.Execute);
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

			await handler.requestPermission('tool-1', 'Test', ToolCallKind.Read);

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});
	});

	describe('auto-approval from settings', () => {
		it('should auto-approve based on autoApproveKinds', async () => {
			const mockCallback = vi.fn();
			handler = new PermissionHandler([ToolCallKind.Read, ToolCallKind.Write]);
			handler.onRequestPermission(mockCallback);

			// Read should auto-approve
			const readDecision = await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			expect(readDecision).toBe('allow_once');
			expect(mockCallback).not.toHaveBeenCalled();

            // Write should auto-approve
            const writeDecision = await handler.requestPermission('tool-2', 'Write', ToolCallKind.Write);
            expect(writeDecision).toBe('allow_once');
			expect(mockCallback).not.toHaveBeenCalled();

			// Execute should ask
			mockCallback.mockResolvedValue('allow_once' as PermissionDecision);
			const executeDecision = await handler.requestPermission('tool-3', 'Execute', ToolCallKind.Execute);
			expect(executeDecision).toBe('allow_once');
			expect(mockCallback).toHaveBeenCalledTimes(1);
		});

		it('should handle empty autoApproveKinds', async () => {
			const mockCallback = vi.fn().mockResolvedValue('allow_once' as PermissionDecision);
			handler = new PermissionHandler([]);
			handler.onRequestPermission(mockCallback);

			await handler.requestPermission('tool-1', 'Read', ToolCallKind.Read);
			expect(mockCallback).toHaveBeenCalled();
		});
	});
});

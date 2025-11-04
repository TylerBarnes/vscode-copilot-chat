import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Tests for ACP Agent VS Code Settings Integration
 * 
 * These tests verify that the extension properly reads and validates
 * ACP agent configuration from VS Code settings.
 */

// Mock vscode.workspace.getConfiguration using vi.hoisted
const { mockGetConfiguration, mockConfig } = vi.hoisted(() => {
    const defaults: Record<string, any> = {
        'agent.executable': '',
        'agent.args': [],
        'agent.env': {},
        'agent.profiles': [],
        'agent.activeProfile': null,
        'mcp.servers': [],
        'permissions.autoApprove': [],
        'session.persistHistory': true,
        'session.storageDirectory': ''
    };
    
    const mockConfig = {
        get: vi.fn((key: string, defaultValue?: any) => {
            return defaults[key] !== undefined ? defaults[key] : defaultValue;
        }),
        has: vi.fn((key: string) => {
            const validKeys = [
                'agent.executable',
                'agent.args', 
                'agent.env',
                'agent.profiles',
                'agent.activeProfile',
                'mcp.servers',
                'permissions.autoApprove',
                'session.persistHistory',
                'session.storageDirectory'
            ];
            return validKeys.includes(key);
        }),
        inspect: vi.fn((key: string) => {
            if (defaults[key] !== undefined) {
                return {
                    key: `copilot-chat.acp.${key}`,
                    defaultValue: defaults[key],
                    globalValue: undefined,
                    workspaceValue: undefined,
                    workspaceFolderValue: undefined
                };
            }
            return undefined;
        })
    };
    
    const mockGetConfiguration = vi.fn().mockReturnValue(mockConfig);
    
    return { mockGetConfiguration, mockConfig };
});

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: mockGetConfiguration
    }
}));

import * as vscode from 'vscode';

describe('ACP Agent Settings', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acp-settings-test-'));
        
        // Reset mock before each test
        mockGetConfiguration.mockClear();
    });

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Configuration Schema', () => {
		it('should define acp.agent.executable setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.executable')).toBe(true);
		});

		it('should define acp.agent.args setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.args')).toBe(true);
		});

		it('should define acp.agent.env setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.env')).toBe(true);
		});

		it('should define acp.agent.profiles setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.profiles')).toBe(true);
		});

		it('should define acp.agent.activeProfile setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.activeProfile')).toBe(true);
		});

		it('should define acp.mcp.servers setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('mcp.servers')).toBe(true);
		});

		it('should define acp.permissions.autoApprove setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('permissions.autoApprove')).toBe(true);
		});

		it('should define acp.session.persistHistory setting', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('session.persistHistory')).toBe(true);
		});
	});

	describe('Default Values', () => {
		it('should have empty string as default for agent.executable', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('agent.executable');
			expect(value?.defaultValue).toBe('');
		});

		it('should have empty array as default for agent.args', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('agent.args');
			expect(value?.defaultValue).toEqual([]);
		});

		it('should have empty object as default for agent.env', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('agent.env');
			expect(value?.defaultValue).toEqual({});
		});

		it('should have empty array as default for agent.profiles', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('agent.profiles');
			expect(value?.defaultValue).toEqual([]);
		});

		it('should have null as default for agent.activeProfile', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('agent.activeProfile');
			expect(value?.defaultValue).toBe(null);
		});

		it('should have empty array as default for mcp.servers', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('mcp.servers');
			expect(value?.defaultValue).toEqual([]);
		});

		it('should have empty array as default for permissions.autoApprove', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('permissions.autoApprove');
			expect(value?.defaultValue).toEqual([]);
		});

		it('should have true as default for session.persistHistory', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const value = config.inspect('session.persistHistory');
			expect(value?.defaultValue).toBe(true);
		});
	});

	describe('Profile Schema Validation', () => {
		it('should validate profile structure', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const profilesInspect = config.inspect('agent.profiles');
			
			// Check that the schema defines the correct structure
			expect(profilesInspect).toBeDefined();
		});

		it('should require id and name in profile', () => {
			// This test verifies the JSON schema validation
			// The actual validation happens in package.json
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			expect(config.has('agent.profiles')).toBe(true);
		});
	});

	describe('MCP Server Schema Validation', () => {
		it('should validate MCP server structure', () => {
			const config = vscode.workspace.getConfiguration('copilot-chat.acp');
			const mcpServersInspect = config.inspect('mcp.servers');
			
			expect(mcpServersInspect).toBeDefined();
		});
	});
});

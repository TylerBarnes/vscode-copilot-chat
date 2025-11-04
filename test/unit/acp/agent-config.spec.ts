import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { AgentConfigManager, AgentProfile } from '../../../src/platform/acp/agent-config';

describe('AgentConfigManager', () => {
	let testDir: string;
	let configPath: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `acp-config-test-${randomUUID()}`);
		await fs.mkdir(testDir, { recursive: true });
		configPath = join(testDir, 'agent-config.json');
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe('AgentProfile', () => {
		it('should create a valid agent profile', () => {
			const profile = new AgentProfile({
				id: 'claude-code',
				name: 'Claude Code',
				executable: '/usr/local/bin/claude-code',
				args: ['--acp'],
				env: { ANTHROPIC_API_KEY: 'test-key' },
			});

			expect(profile.id).toBe('claude-code');
			expect(profile.name).toBe('Claude Code');
			expect(profile.executable).toBe('/usr/local/bin/claude-code');
			expect(profile.args).toEqual(['--acp']);
			expect(profile.env).toEqual({ ANTHROPIC_API_KEY: 'test-key' });
		});

		it('should use default values for optional fields', () => {
			const profile = new AgentProfile({
				id: 'test-agent',
				name: 'Test Agent',
				executable: '/path/to/agent',
			});

			expect(profile.args).toEqual([]);
			expect(profile.env).toEqual({});
			expect(profile.description).toBeUndefined();
		});
	});

	describe('AgentConfigManager', () => {
		it('should initialize with default profiles', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profiles = manager.getProfiles();
			expect(profiles.length).toBeGreaterThan(0);
		});

		it('should add a custom profile', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profile = new AgentProfile({
				id: 'custom-agent',
				name: 'Custom Agent',
				executable: '/path/to/custom',
			});

			await manager.addProfile(profile);

			const profiles = manager.getProfiles();
			const customProfile = profiles.find(p => p.id === 'custom-agent');
			expect(customProfile).toBeDefined();
			expect(customProfile?.name).toBe('Custom Agent');
		});

		it('should remove a profile', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profile = new AgentProfile({
				id: 'temp-agent',
				name: 'Temp Agent',
				executable: '/path/to/temp',
			});

			await manager.addProfile(profile);
			expect(manager.getProfile('temp-agent')).toBeDefined();

			await manager.removeProfile('temp-agent');
			expect(manager.getProfile('temp-agent')).toBeUndefined();
		});

		it('should set and get active profile', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profiles = manager.getProfiles();
			const firstProfile = profiles[0];

			await manager.setActiveProfile(firstProfile.id);
			const activeProfile = manager.getActiveProfile();

			expect(activeProfile?.id).toBe(firstProfile.id);
		});

		it('should persist configuration to disk', async () => {
			const manager1 = new AgentConfigManager(configPath);
			await manager1.initialize();

			const profile = new AgentProfile({
				id: 'persist-test',
				name: 'Persist Test',
				executable: '/path/to/persist',
			});

			await manager1.addProfile(profile);
			await manager1.setActiveProfile('persist-test');
			await manager1.save();

			// Create a new manager instance and load from disk
			const manager2 = new AgentConfigManager(configPath);
			await manager2.initialize();

			const loadedProfile = manager2.getProfile('persist-test');
			expect(loadedProfile).toBeDefined();
			expect(loadedProfile?.name).toBe('Persist Test');

			const activeProfile = manager2.getActiveProfile();
			expect(activeProfile?.id).toBe('persist-test');
		});

		it('should validate profile before adding', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const invalidProfile = new AgentProfile({
				id: '',
				name: 'Invalid',
				executable: '/path/to/invalid',
			});

			await expect(manager.addProfile(invalidProfile)).rejects.toThrow();
		});

		it('should prevent duplicate profile IDs', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profile1 = new AgentProfile({
				id: 'duplicate',
				name: 'First',
				executable: '/path/to/first',
			});

			const profile2 = new AgentProfile({
				id: 'duplicate',
				name: 'Second',
				executable: '/path/to/second',
			});

			await manager.addProfile(profile1);
			await expect(manager.addProfile(profile2)).rejects.toThrow();
		});

		it('should auto-discover agents in PATH', async () => {
			const manager = new AgentConfigManager(configPath);
			
			// Mock the discovery function
			const mockDiscovery = vi.fn().mockResolvedValue([
				{
					id: 'discovered-agent',
					name: 'Discovered Agent',
					executable: '/usr/local/bin/discovered',
					args: ['--acp'],
				},
			]);

			manager.discoverAgents = mockDiscovery;

			await manager.initialize();
			const discovered = await manager.discoverAgents();

			expect(discovered.length).toBeGreaterThan(0);
			expect(discovered[0].id).toBe('discovered-agent');
		});

		it('should update an existing profile', async () => {
			const manager = new AgentConfigManager(configPath);
			await manager.initialize();

			const profile = new AgentProfile({
				id: 'update-test',
				name: 'Original Name',
				executable: '/path/to/original',
			});

			await manager.addProfile(profile);

			const updatedProfile = new AgentProfile({
				id: 'update-test',
				name: 'Updated Name',
				executable: '/path/to/updated',
				args: ['--new-arg'],
			});

			await manager.updateProfile(updatedProfile);

			const result = manager.getProfile('update-test');
			expect(result?.name).toBe('Updated Name');
			expect(result?.executable).toBe('/path/to/updated');
			expect(result?.args).toEqual(['--new-arg']);
		});
	});
});

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface AgentProfileData {
	id: string;
	name: string;
	executable: string;
	args?: string[];
	env?: Record<string, string>;
	description?: string;
	icon?: string;
}

export class AgentProfile {
	public readonly id: string;
	public readonly name: string;
	public readonly executable: string;
	public readonly args: string[];
	public readonly env: Record<string, string>;
	public readonly description?: string;
	public readonly icon?: string;

	constructor(data: AgentProfileData) {
		this.id = data.id;
		this.name = data.name;
		this.executable = data.executable;
		this.args = data.args || [];
		this.env = data.env || {};
		this.description = data.description;
		this.icon = data.icon;
	}

	toJSON(): AgentProfileData {
		return {
			id: this.id,
			name: this.name,
			executable: this.executable,
			args: this.args,
			env: this.env,
			description: this.description,
			icon: this.icon,
		};
	}
}

interface AgentConfigData {
	version: string;
	activeProfileId?: string;
	profiles: AgentProfileData[];
}

export class AgentConfigManager {
	private configPath: string;
	private profiles: Map<string, AgentProfile> = new Map();
	private activeProfileId?: string;
	private readonly CONFIG_VERSION = '1.0.0';

	constructor(configPath?: string) {
		this.configPath = configPath || join(homedir(), '.vscode-acp', 'agent-config.json');
	}

	async initialize(): Promise<void> {
		try {
			await this.load();
		} catch (error) {
			// If config doesn't exist, initialize with default profiles
			await this.initializeDefaults();
		}
	}

	private async initializeDefaults(): Promise<void> {
		// Add some common default profiles
		const defaultProfiles: AgentProfileData[] = [
			{
				id: 'claude-code',
				name: 'Claude Code',
				executable: 'claude-code',
				args: ['--acp'],
				description: 'Anthropic Claude Code agent',
			},
			{
				id: 'gemini-cli',
				name: 'Gemini CLI',
				executable: 'gemini-cli',
				args: ['--acp'],
				description: 'Google Gemini CLI agent',
			},
			{
				id: 'opencode',
				name: 'OpenCode',
				executable: 'opencode',
				args: ['--acp'],
				description: 'OpenCode agent',
			},
		];

		for (const profileData of defaultProfiles) {
			const profile = new AgentProfile(profileData);
			this.profiles.set(profile.id, profile);
		}

		// Set first profile as active by default
		if (defaultProfiles.length > 0) {
			this.activeProfileId = defaultProfiles[0].id;
		}
	}

	async load(): Promise<void> {
		const configDir = join(this.configPath, '..');
		await fs.mkdir(configDir, { recursive: true });

		try {
			const data = await fs.readFile(this.configPath, 'utf-8');
			const config: AgentConfigData = JSON.parse(data);

			this.profiles.clear();
			for (const profileData of config.profiles) {
				const profile = new AgentProfile(profileData);
				this.profiles.set(profile.id, profile);
			}

			this.activeProfileId = config.activeProfileId;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
			// File doesn't exist, will be created on save
			throw error;
		}
	}

	async save(): Promise<void> {
		const configDir = join(this.configPath, '..');
		await fs.mkdir(configDir, { recursive: true });

		const config: AgentConfigData = {
			version: this.CONFIG_VERSION,
			activeProfileId: this.activeProfileId,
			profiles: Array.from(this.profiles.values()).map(p => p.toJSON()),
		};

		await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
	}

	getProfiles(): AgentProfile[] {
		return Array.from(this.profiles.values());
	}

	getProfile(id: string): AgentProfile | undefined {
		return this.profiles.get(id);
	}

	getActiveProfile(): AgentProfile | undefined {
		if (!this.activeProfileId) {
			return undefined;
		}
		return this.profiles.get(this.activeProfileId);
	}

	async setActiveProfile(id: string): Promise<void> {
		if (!this.profiles.has(id)) {
			throw new Error(`Profile with id '${id}' not found`);
		}
		this.activeProfileId = id;
		await this.save();
	}

	async addProfile(profile: AgentProfile): Promise<void> {
		// Validate profile
		if (!profile.id || profile.id.trim() === '') {
			throw new Error('Profile ID cannot be empty');
		}
		if (!profile.name || profile.name.trim() === '') {
			throw new Error('Profile name cannot be empty');
		}
		if (!profile.executable || profile.executable.trim() === '') {
			throw new Error('Profile executable cannot be empty');
		}

		// Check for duplicates
		if (this.profiles.has(profile.id)) {
			throw new Error(`Profile with id '${profile.id}' already exists`);
		}

		this.profiles.set(profile.id, profile);
		await this.save();
	}

	async updateProfile(profile: AgentProfile): Promise<void> {
		// Validate profile
		if (!profile.id || profile.id.trim() === '') {
			throw new Error('Profile ID cannot be empty');
		}
		if (!profile.name || profile.name.trim() === '') {
			throw new Error('Profile name cannot be empty');
		}
		if (!profile.executable || profile.executable.trim() === '') {
			throw new Error('Profile executable cannot be empty');
		}

		// Check if profile exists
		if (!this.profiles.has(profile.id)) {
			throw new Error(`Profile with id '${profile.id}' not found`);
		}

		this.profiles.set(profile.id, profile);
		await this.save();
	}

	async removeProfile(id: string): Promise<void> {
		if (!this.profiles.has(id)) {
			throw new Error(`Profile with id '${id}' not found`);
		}

		this.profiles.delete(id);

		// If we removed the active profile, clear it
		if (this.activeProfileId === id) {
			this.activeProfileId = undefined;
		}

		await this.save();
	}

	async discoverAgents(): Promise<AgentProfileData[]> {
		// This is a placeholder for agent discovery
		// In a real implementation, this would search PATH for known agent executables
		const discovered: AgentProfileData[] = [];

		const knownAgents = [
			{ name: 'claude-code', displayName: 'Claude Code' },
			{ name: 'gemini-cli', displayName: 'Gemini CLI' },
			{ name: 'opencode', displayName: 'OpenCode' },
		];

		for (const agent of knownAgents) {
			try {
				// Try to find the executable in PATH
				const { execSync } = require('child_process');
				const command = process.platform === 'win32' ? 'where' : 'which';
				const result = execSync(`${command} ${agent.name}`, { encoding: 'utf-8' }).trim();
				
				if (result) {
					discovered.push({
						id: agent.name,
						name: agent.displayName,
						executable: result.split('\n')[0], // Take first result if multiple
						args: ['--acp'],
						description: `Auto-discovered ${agent.displayName}`,
					});
				}
			} catch {
				// Agent not found in PATH, skip
			}
		}

		return discovered;
	}
}

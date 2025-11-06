import * as vscode from 'vscode';

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
        try {
            console.log('[AgentProfile] Converting to JSON, id:', this.id);
            console.log('[AgentProfile] Properties check:');
            console.log('[AgentProfile] - id:', this.id, '(type:', typeof this.id, ')');
            console.log('[AgentProfile] - name:', this.name, '(type:', typeof this.name, ')');
            console.log('[AgentProfile] - executable:', this.executable, '(type:', typeof this.executable, ')');
            console.log('[AgentProfile] - args:', this.args, '(type:', typeof this.args, ')');
            console.log('[AgentProfile] - env:', this.env, '(type:', typeof this.env, ')');
            
            const result = {
                id: this.id,
                name: this.name,
                executable: this.executable,
                args: this.args,
                env: this.env,
                description: this.description,
                icon: this.icon,
            };
            
            console.log('[AgentProfile] JSON conversion completed successfully');
            return result;
        } catch (error) {
            console.log('[AgentProfile] ERROR in toJSON():', error);
            console.log('[AgentProfile] Error type:', typeof error);
            console.log('[AgentProfile] Error message:', error?.message);
            throw error;
        }
    }
}

interface AgentConfigData {
	version: string;
	activeProfileId?: string;
	profiles: AgentProfileData[];
}

export class AgentConfigManager {
    private readonly configUri: vscode.Uri;
    private profiles: Map<string, AgentProfile> = new Map();
    private activeProfileId?: string;
    private readonly CONFIG_VERSION = '1.0.0';

    constructor(configPath: string) {
        this.configUri = vscode.Uri.file(configPath);
    }

    async initialize(): Promise<void> {
        console.log('[AgentConfigManager] Initializing...');
        console.log('[AgentConfigManager] Config URI:', this.configUri);
        try {
            await this.load();
            console.log('[AgentConfigManager] Loaded config successfully');
        } catch (error) {
            console.log('[AgentConfigManager] Failed to load config, initializing defaults:', error);
            // If config doesn't exist, initialize with default profiles
            await this.initializeDefaults();
        }
    }

	private async initializeDefaults(): Promise<void> {
		// Add some common default profiles
        // Initialize with empty profiles - users should configure their own ACP agents
        const defaultProfiles: AgentProfileData[] = [];

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
        try {
            console.log('[AgentConfigManager] Loading config from:', this.configUri?.fsPath);
            console.log('[AgentConfigManager] configUri type:', typeof this.configUri);
            console.log('[AgentConfigManager] configUri exists:', !!this.configUri);
            
            if (!this.configUri) {
                console.log('[AgentConfigManager] ERROR: configUri is undefined');
                throw new Error('configUri is undefined');
            }

            const data = await vscode.workspace.fs.readFile(this.configUri);
            console.log('[AgentConfigManager] Successfully read file, data length:', data.length);
            
            const configText = Buffer.from(data).toString('utf-8');
            console.log('[AgentConfigManager] Config text length:', configText.length);
            
            const config: AgentConfigData = JSON.parse(configText);
            console.log('[AgentConfigManager] Parsed config, profiles count:', config.profiles?.length);

            this.profiles.clear();
            for (const profileData of config.profiles) {
                console.log('[AgentConfigManager] Processing profile:', profileData.id);
                const profile = new AgentProfile(profileData);
                this.profiles.set(profile.id, profile);
            }

            this.activeProfileId = config.activeProfileId;
            console.log('[AgentConfigManager] Load completed successfully');
        } catch (error) {
            console.log('[AgentConfigManager] Load failed with error:', error);
            console.log('[AgentConfigManager] Error type:', typeof error);
            console.log('[AgentConfigManager] Error message:', error?.message);
            // File doesn't exist, will be created on save
            throw error;
        }
    }

    async save(): Promise<void> {
        try {
            console.log('[AgentConfigManager] Saving config to:', this.configUri?.fsPath);
            console.log('[AgentConfigManager] configUri type:', typeof this.configUri);
            console.log('[AgentConfigManager] configUri exists:', !!this.configUri);
            
            if (!this.configUri) {
                console.log('[AgentConfigManager] ERROR: configUri is undefined during save');
                throw new Error('configUri is undefined during save');
            }

            const config: AgentConfigData = {
                version: this.CONFIG_VERSION,
                activeProfileId: this.activeProfileId,
                profiles: Array.from(this.profiles.values()).map(p => {
                    console.log('[AgentConfigManager] Converting profile to JSON:', p.id);
                    return p.toJSON();
                }),
            };

            console.log('[AgentConfigManager] Config object created, profiles count:', config.profiles.length);
            const content = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');
            console.log('[AgentConfigManager] Config buffer created, length:', content.length);
            
            await vscode.workspace.fs.writeFile(this.configUri, content);
            console.log('[AgentConfigManager] Save completed successfully');
        } catch (error) {
            console.log('[AgentConfigManager] Save failed with error:', error);
            console.log('[AgentConfigManager] Error type:', typeof error);
            console.log('[AgentConfigManager] Error message:', error?.message);
            throw error;
        }
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

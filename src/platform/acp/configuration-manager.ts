import * as vscode from 'vscode';
import { AgentProfile } from './types';

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

/**
 * Permission policy configuration
 */
export interface PermissionPolicy {
  fileSystem: {
    read: 'allow' | 'deny' | 'prompt';
    write: 'allow' | 'deny' | 'prompt';
    allowedPaths?: string[];
    deniedPaths?: string[];
  };
  terminal: {
    execute: 'allow' | 'deny' | 'prompt';
    allowedCommands?: string[];
    deniedCommands?: string[];
  };
  mcp: {
    toolCall: 'allow' | 'deny' | 'prompt';
    allowedTools?: string[];
    deniedTools?: string[];
  };
}

/**
 * Session configuration
 */
export interface SessionConfig {
  maxMessages: number;
  persistHistory: boolean;
  autoSave: boolean;
  defaultMode?: string;
}

/**
 * Complete ACP configuration
 */
export interface ACPConfiguration {
  agent: {
    profiles: AgentProfile[];
    defaultProfile?: string;
  };
  mcp: {
    servers: McpServerConfig[];
    enabled: boolean;
  };
  permissions: PermissionPolicy;
  session: SessionConfig;
}

/**
 * Manages ACP configuration from VS Code settings
 */
export class ConfigurationManager {
  private static readonly CONFIG_SECTION = 'acp';
  
  constructor(
    private readonly workspaceConfig = vscode.workspace.getConfiguration
  ) {}
  
  /**
   * Get the complete ACP configuration
   */
  getConfiguration(): ACPConfiguration {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    
    return {
      agent: {
        profiles: config.get<AgentProfile[]>('agent.profiles', []),
        defaultProfile: config.get<string>('agent.defaultProfile')
      },
      mcp: {
        servers: config.get<McpServerConfig[]>('mcp.servers', []),
        enabled: config.get<boolean>('mcp.enabled', true)
      },
      permissions: this.getPermissionPolicy(config),
      session: {
        maxMessages: config.get<number>('session.maxMessages', 100),
        persistHistory: config.get<boolean>('session.persistHistory', true),
        autoSave: config.get<boolean>('session.autoSave', true),
        defaultMode: config.get<string>('session.defaultMode')
      }
    };
  }
  
  /**
   * Get agent profiles
   */
  getAgentProfiles(): AgentProfile[] {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    return config.get<AgentProfile[]>('agent.profiles', []);
  }
  
  /**
   * Get default agent profile
   */
  getDefaultProfile(): AgentProfile | undefined {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const defaultName = config.get<string>('agent.defaultProfile');
    
    if (!defaultName) {
      return undefined;
    }
    
    const profiles = this.getAgentProfiles();
    return profiles.find(p => p.name === defaultName);
  }
  
  /**
   * Add or update an agent profile
   */
  async updateAgentProfile(profile: AgentProfile): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const profiles = config.get<AgentProfile[]>('agent.profiles', []);
    
    const existingIndex = profiles.findIndex(p => p.name === profile.name);
    
    let updatedProfiles: AgentProfile[];
    if (existingIndex >= 0) {
      // Replace existing profile
      updatedProfiles = [
        ...profiles.slice(0, existingIndex),
        profile,
        ...profiles.slice(existingIndex + 1)
      ];
    } else {
      // Add new profile
      updatedProfiles = [...profiles, profile];
    }
    
    await config.update('agent.profiles', updatedProfiles, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Remove an agent profile
   */
  async removeAgentProfile(name: string): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const profiles = config.get<AgentProfile[]>('agent.profiles', []);
    
    const filtered = profiles.filter(p => p.name !== name);
    
    await config.update('agent.profiles', filtered, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Set default agent profile
   */
  async setDefaultProfile(name: string): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    await config.update('agent.defaultProfile', name, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Get MCP server configurations
   */
  getMcpServers(): McpServerConfig[] {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    return config.get<McpServerConfig[]>('mcp.servers', []);
  }
  
  /**
   * Check if MCP is enabled
   */
  isMcpEnabled(): boolean {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    return config.get<boolean>('mcp.enabled', true);
  }
  
  /**
   * Add or update an MCP server
   */
  async updateMcpServer(server: McpServerConfig): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const servers = config.get<McpServerConfig[]>('mcp.servers', []);
    
    const existingIndex = servers.findIndex(s => s.name === server.name);
    
    let updatedServers: McpServerConfig[];
    if (existingIndex >= 0) {
      // Replace existing server
      updatedServers = [
        ...servers.slice(0, existingIndex),
        server,
        ...servers.slice(existingIndex + 1)
      ];
    } else {
      // Add new server
      updatedServers = [...servers, server];
    }
    
    await config.update('mcp.servers', updatedServers, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Remove an MCP server
   */
  async removeMcpServer(name: string): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const servers = config.get<McpServerConfig[]>('mcp.servers', []);
    
    const filtered = servers.filter(s => s.name !== name);
    
    await config.update('mcp.servers', filtered, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Set MCP enabled state
   */
  async setMcpEnabled(enabled: boolean): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    await config.update('mcp.enabled', enabled, vscode.ConfigurationTarget.Global);
  }
  
  /**
   * Get permission policy
   */
  getPermissionPolicy(config?: vscode.WorkspaceConfiguration): PermissionPolicy {
    const cfg = config || this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    
    return {
      fileSystem: {
        read: cfg.get<'allow' | 'deny' | 'prompt'>('permissions.fileSystem.read', 'prompt'),
        write: cfg.get<'allow' | 'deny' | 'prompt'>('permissions.fileSystem.write', 'prompt'),
        allowedPaths: cfg.get<string[]>('permissions.fileSystem.allowedPaths'),
        deniedPaths: cfg.get<string[]>('permissions.fileSystem.deniedPaths')
      },
      terminal: {
        execute: cfg.get<'allow' | 'deny' | 'prompt'>('permissions.terminal.execute', 'prompt'),
        allowedCommands: cfg.get<string[]>('permissions.terminal.allowedCommands'),
        deniedCommands: cfg.get<string[]>('permissions.terminal.deniedCommands')
      },
      mcp: {
        toolCall: cfg.get<'allow' | 'deny' | 'prompt'>('permissions.mcp.toolCall', 'prompt'),
        allowedTools: cfg.get<string[]>('permissions.mcp.allowedTools'),
        deniedTools: cfg.get<string[]>('permissions.mcp.deniedTools')
      }
    };
  }
  
  /**
   * Update permission policy
   */
  async updatePermissionPolicy(policy: Partial<PermissionPolicy>): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    
    if (policy.fileSystem) {
      if (policy.fileSystem.read !== undefined) {
        await config.update('permissions.fileSystem.read', policy.fileSystem.read, vscode.ConfigurationTarget.Global);
      }
      if (policy.fileSystem.write !== undefined) {
        await config.update('permissions.fileSystem.write', policy.fileSystem.write, vscode.ConfigurationTarget.Global);
      }
      if (policy.fileSystem.allowedPaths !== undefined) {
        await config.update('permissions.fileSystem.allowedPaths', policy.fileSystem.allowedPaths, vscode.ConfigurationTarget.Global);
      }
      if (policy.fileSystem.deniedPaths !== undefined) {
        await config.update('permissions.fileSystem.deniedPaths', policy.fileSystem.deniedPaths, vscode.ConfigurationTarget.Global);
      }
    }
    
    if (policy.terminal) {
      if (policy.terminal.execute !== undefined) {
        await config.update('permissions.terminal.execute', policy.terminal.execute, vscode.ConfigurationTarget.Global);
      }
      if (policy.terminal.allowedCommands !== undefined) {
        await config.update('permissions.terminal.allowedCommands', policy.terminal.allowedCommands, vscode.ConfigurationTarget.Global);
      }
      if (policy.terminal.deniedCommands !== undefined) {
        await config.update('permissions.terminal.deniedCommands', policy.terminal.deniedCommands, vscode.ConfigurationTarget.Global);
      }
    }
    
    if (policy.mcp) {
      if (policy.mcp.toolCall !== undefined) {
        await config.update('permissions.mcp.toolCall', policy.mcp.toolCall, vscode.ConfigurationTarget.Global);
      }
      if (policy.mcp.allowedTools !== undefined) {
        await config.update('permissions.mcp.allowedTools', policy.mcp.allowedTools, vscode.ConfigurationTarget.Global);
      }
      if (policy.mcp.deniedTools !== undefined) {
        await config.update('permissions.mcp.deniedTools', policy.mcp.deniedTools, vscode.ConfigurationTarget.Global);
      }
    }
  }
  
  /**
   * Get session configuration
   */
  getSessionConfig(): SessionConfig {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    
    return {
      maxMessages: config.get<number>('session.maxMessages', 100),
      persistHistory: config.get<boolean>('session.persistHistory', true),
      autoSave: config.get<boolean>('session.autoSave', true),
      defaultMode: config.get<string>('session.defaultMode')
    };
  }
  
  /**
   * Update session configuration
   */
  async updateSessionConfig(sessionConfig: Partial<SessionConfig>): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    
    if (sessionConfig.maxMessages !== undefined) {
      await config.update('session.maxMessages', sessionConfig.maxMessages, vscode.ConfigurationTarget.Global);
    }
    if (sessionConfig.persistHistory !== undefined) {
      await config.update('session.persistHistory', sessionConfig.persistHistory, vscode.ConfigurationTarget.Global);
    }
    if (sessionConfig.autoSave !== undefined) {
      await config.update('session.autoSave', sessionConfig.autoSave, vscode.ConfigurationTarget.Global);
    }
    if (sessionConfig.defaultMode !== undefined) {
      await config.update('session.defaultMode', sessionConfig.defaultMode, vscode.ConfigurationTarget.Global);
    }
  }
  
  /**
   * Listen for configuration changes
   */
  onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        callback(e);
      }
    });
  }

  /**
   * Alias for onConfigurationChanged (compatibility)
   */
  onDidChangeConfiguration(callback: () => void): vscode.Disposable {
    return this.onConfigurationChanged(() => callback());
  }

  /**
   * Get a specific MCP server by name (compatibility method)
   */
  getMcpServer(serverName: string): MCPServerConfig | undefined {
    const servers = this.getMcpServers();
    return servers.find(s => s.name === serverName);
  }

  /**
   * Add an MCP server (compatibility method)
   */
  async addMcpServer(config: MCPServerConfig): Promise<void> {
    const servers = this.getMcpServers();
    servers.push(config);
    await this.updateMcpServers(servers);
  }

  /**
   * Get all permission policies (compatibility method)
   */
  getPermissionPolicies(): PermissionPolicy[] {
    // Return all permission policies as an array
    const policies: PermissionPolicy[] = [];
    const fsPolicy = this.getPermissionPolicy('filesystem');
    const terminalPolicy = this.getPermissionPolicy('terminal');
    
    if (fsPolicy) {
      policies.push({ resource: 'filesystem', ...fsPolicy } as PermissionPolicy);
    }
    if (terminalPolicy) {
      policies.push({ resource: 'terminal', ...terminalPolicy } as PermissionPolicy);
    }
    
    return policies;
  }

  /**
   * Add a permission policy (compatibility method)
   */
  async addPermissionPolicy(policy: PermissionPolicy): Promise<void> {
    await this.updatePermissionPolicy(policy.resource, policy);
  }
}

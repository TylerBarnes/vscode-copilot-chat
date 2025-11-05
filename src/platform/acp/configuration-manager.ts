import * as vscode from 'vscode';
import { AgentProfile } from './types';
import type { MCPServerConfig } from './mcp-manager';

/**
 * Permission configuration structure (nested)
 */
export interface PermissionConfiguration {
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
    servers: MCPServerConfig[];
    enabled: boolean;
  };
  permissions: PermissionConfiguration;
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
        servers: config.get<MCPServerConfig[]>('mcp.servers', []),
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
  getMcpServers(): MCPServerConfig[] {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    return config.get<MCPServerConfig[]>('mcp.servers', []);
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
  async updateMcpServer(server: MCPServerConfig): Promise<void> {
    const config = this.workspaceConfig(ConfigurationManager.CONFIG_SECTION);
    const servers = config.get<MCPServerConfig[]>('mcp.servers', []);
    
    const existingIndex = servers.findIndex(s => s.name === server.name);
    
    let updatedServers: MCPServerConfig[];
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
    const servers = config.get<MCPServerConfig[]>('mcp.servers', []);
    
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
  getPermissionPolicy(config?: vscode.WorkspaceConfiguration): PermissionConfiguration {
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
   * Update permission policy (compatibility method)
   */
  async updatePermissionPolicy(pattern: string, policy: Partial<import('./types').PermissionPolicy>): Promise<void> {
    // Remove the old policy first
    await this.removePermissionPolicy(pattern);
    
    // Add the updated policy
    if (policy.pattern && policy.action) {
      await this.addPermissionPolicy({
        pattern: policy.pattern,
        action: policy.action,
        description: policy.description
      });
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
    await this.updateMcpServer(config);
  }

  /**
   * Get all permission policies (compatibility method)
   */
  getPermissionPolicies(): import('./types').PermissionPolicy[] {
    // Return all permission policies as an array
    const policies: import('./types').PermissionPolicy[] = [];
    
    // Convert nested configuration to flat policy list
    const config = vscode.workspace.getConfiguration('acp.chat');
    const permissionsConfig = config.get<any>('permissions', {});
    
    // Add file system policies
    if (permissionsConfig.fileSystem?.allowedPaths) {
      for (const path of permissionsConfig.fileSystem.allowedPaths) {
        policies.push({ pattern: path, action: 'allow', description: 'File system access' });
      }
    }
    if (permissionsConfig.fileSystem?.deniedPaths) {
      for (const path of permissionsConfig.fileSystem.deniedPaths) {
        policies.push({ pattern: path, action: 'deny', description: 'File system access' });
      }
    }
    
    // Add terminal policies
    if (permissionsConfig.terminal?.allowedCommands) {
      for (const cmd of permissionsConfig.terminal.allowedCommands) {
        policies.push({ pattern: cmd, action: 'allow', description: 'Terminal command' });
      }
    }
    if (permissionsConfig.terminal?.deniedCommands) {
      for (const cmd of permissionsConfig.terminal.deniedCommands) {
        policies.push({ pattern: cmd, action: 'deny', description: 'Terminal command' });
      }
    }
    
    return policies;
  }

  /**
   * Add a permission policy (compatibility method)
   */
  async addPermissionPolicy(policy: import('./types').PermissionPolicy): Promise<void> {
    // Store the policy in the appropriate configuration section
    const config = vscode.workspace.getConfiguration('acp.chat');
    const permissionsConfig = config.get<any>('permissions', {});
    
    // Determine which section to update based on pattern
    if (policy.pattern.includes('/') || policy.pattern.includes('\\')) {
      // File system path
      const section = policy.action === 'allow' ? 'allowedPaths' : 'deniedPaths';
      if (!permissionsConfig.fileSystem) permissionsConfig.fileSystem = {};
      if (!permissionsConfig.fileSystem[section]) permissionsConfig.fileSystem[section] = [];
      permissionsConfig.fileSystem[section].push(policy.pattern);
    } else {
      // Terminal command
      const section = policy.action === 'allow' ? 'allowedCommands' : 'deniedCommands';
      if (!permissionsConfig.terminal) permissionsConfig.terminal = {};
      if (!permissionsConfig.terminal[section]) permissionsConfig.terminal[section] = [];
      permissionsConfig.terminal[section].push(policy.pattern);
    }
    
    await config.update('permissions', permissionsConfig, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Remove a permission policy (compatibility method)
   */
  async removePermissionPolicy(pattern: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('acp.chat');
    const permissionsConfig = config.get<any>('permissions', {});
    
    // Remove from all sections
    if (permissionsConfig.fileSystem?.allowedPaths) {
      permissionsConfig.fileSystem.allowedPaths = permissionsConfig.fileSystem.allowedPaths.filter((p: string) => p !== pattern);
    }
    if (permissionsConfig.fileSystem?.deniedPaths) {
      permissionsConfig.fileSystem.deniedPaths = permissionsConfig.fileSystem.deniedPaths.filter((p: string) => p !== pattern);
    }
    if (permissionsConfig.terminal?.allowedCommands) {
      permissionsConfig.terminal.allowedCommands = permissionsConfig.terminal.allowedCommands.filter((c: string) => c !== pattern);
    }
    if (permissionsConfig.terminal?.deniedCommands) {
      permissionsConfig.terminal.deniedCommands = permissionsConfig.terminal.deniedCommands.filter((c: string) => c !== pattern);
    }
    
    await config.update('permissions', permissionsConfig, vscode.ConfigurationTarget.Workspace);
  }
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationManager } from '../../../src/platform/acp/configuration-manager';
import { AgentProfile } from '../../../src/platform/acp/types';
import { MCPServerConfig } from '../../../src/platform/acp/mcp-manager';

// Mock vscode module
vi.mock('vscode', () => {
  const mockConfig = {
    get: vi.fn(),
    update: vi.fn(),
    has: vi.fn(),
    inspect: vi.fn()
  };
  
  const mockDisposable = {
    dispose: vi.fn()
  };
  
  let configChangeCallback: any = null;
  
  return {
    workspace: {
      getConfiguration: vi.fn(() => mockConfig),
      onDidChangeConfiguration: vi.fn((callback) => {
        configChangeCallback = callback;
        return mockDisposable;
      })
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
      WorkspaceFolder: 3
    },
    // Export for testing
    __mocks: {
      mockConfig,
      mockDisposable,
      getConfigChangeCallback: () => configChangeCallback
    }
  };
});

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager;
  let vscode: any;
  let mockConfig: any;
  let mockDisposable: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vscode = await import('vscode');
    mockConfig = (vscode as any).__mocks.mockConfig;
    mockDisposable = (vscode as any).__mocks.mockDisposable;
    manager = new ConfigurationManager();
  });
  
  describe('getConfiguration', () => {
    it('should return complete configuration', () => {
      const mockProfiles: AgentProfile[] = [
        { name: 'test-agent', executable: '/path/to/agent', args: [], env: {} }
      ];
      
      const mockServers: MCPServerConfig[] = [
        { name: 'test-server', transport: 'stdio', command: 'node', args: ['server.js'] }
      ];
      
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          'agent.profiles': mockProfiles,
          'agent.defaultProfile': 'test-agent',
          'mcp.servers': mockServers,
          'mcp.enabled': true,
          'permissions.fileSystem.read': 'prompt',
          'permissions.fileSystem.write': 'prompt',
          'permissions.terminal.execute': 'prompt',
          'permissions.mcp.toolCall': 'prompt',
          'session.maxMessages': 100,
          'session.persistHistory': true,
          'session.autoSave': true,
          'session.defaultMode': 'chat'
        };
        return values[key] ?? defaultValue;
      });
      
      const config = manager.getConfiguration();
      
      expect(config.agent.profiles).toEqual(mockProfiles);
      expect(config.agent.defaultProfile).toBe('test-agent');
      expect(config.mcp.servers).toEqual(mockServers);
      expect(config.mcp.enabled).toBe(true);
      expect(config.permissions.fileSystem.read).toBe('prompt');
      expect(config.session.maxMessages).toBe(100);
    });
    
    it('should use default values when config is empty', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => defaultValue);
      
      const config = manager.getConfiguration();
      
      expect(config.agent.profiles).toEqual([]);
      expect(config.agent.defaultProfile).toBeUndefined();
      expect(config.mcp.servers).toEqual([]);
      expect(config.mcp.enabled).toBe(true);
      expect(config.session.maxMessages).toBe(100);
    });
  });
  
  describe('getAgentProfiles', () => {
    it('should return agent profiles', () => {
      const mockProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfig.get.mockReturnValue(mockProfiles);
      
      const profiles = manager.getAgentProfiles();
      
      expect(profiles).toEqual(mockProfiles);
      expect(mockConfig.get).toHaveBeenCalledWith('agent.profiles', []);
    });
    
    it('should return empty array when no profiles configured', () => {
      mockConfig.get.mockReturnValue([]);
      
      const profiles = manager.getAgentProfiles();
      
      expect(profiles).toEqual([]);
    });
  });
  
  describe('getDefaultProfile', () => {
    it('should return default profile when configured', () => {
      const mockProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'agent.defaultProfile') return 'agent2';
        if (key === 'agent.profiles') return mockProfiles;
        return defaultValue;
      });
      
      const profile = manager.getDefaultProfile();
      
      expect(profile).toEqual(mockProfiles[1]);
    });
    
    it('should return undefined when no default configured', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'agent.defaultProfile') return undefined;
        return defaultValue;
      });
      
      const profile = manager.getDefaultProfile();
      
      expect(profile).toBeUndefined();
    });
    
    it('should return undefined when default profile not found', () => {
      const mockProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'agent.defaultProfile') return 'nonexistent';
        if (key === 'agent.profiles') return mockProfiles;
        return defaultValue;
      });
      
      const profile = manager.getDefaultProfile();
      
      expect(profile).toBeUndefined();
    });
  });
  
  describe('updateAgentProfile', () => {
    it('should add new profile', async () => {
      const existingProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      const newProfile: AgentProfile = {
        name: 'agent2',
        executable: '/path/2',
        args: ['--verbose'],
        env: { DEBUG: 'true' }
      };
      
      mockConfig.get.mockReturnValue(existingProfiles);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateAgentProfile(newProfile);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'agent.profiles',
        [...existingProfiles, newProfile],
        1 // ConfigurationTarget.Global
      );
    });
    
    it('should update existing profile', async () => {
      const existingProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      const updatedProfile: AgentProfile = {
        name: 'agent1',
        executable: '/new/path',
        args: ['--new-arg'],
        env: { NEW: 'value' }
      };
      
      mockConfig.get.mockReturnValue(existingProfiles);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateAgentProfile(updatedProfile);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'agent.profiles',
        [updatedProfile, existingProfiles[1]],
        1
      );
    });
  });
  
  describe('removeAgentProfile', () => {
    it('should remove profile by name', async () => {
      const existingProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfig.get.mockReturnValue(existingProfiles);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.removeAgentProfile('agent1');
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'agent.profiles',
        [existingProfiles[1]],
        1
      );
    });
    
    it('should do nothing if profile not found', async () => {
      const existingProfiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfig.get.mockReturnValue(existingProfiles);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.removeAgentProfile('nonexistent');
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'agent.profiles',
        existingProfiles,
        1
      );
    });
  });
  
  describe('setDefaultProfile', () => {
    it('should set default profile', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.setDefaultProfile('agent1');
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'agent.defaultProfile',
        'agent1',
        1
      );
    });
  });
  
  describe('getMcpServers', () => {
    it('should return MCP servers', () => {
      const mockServers: MCPServerConfig[] = [
        { name: 'server1', transport: 'stdio', command: 'node', args: ['s1.js'] },
        { name: 'server2', transport: 'http', command: '', url: 'http://localhost:3000' }
      ];
      
      mockConfig.get.mockReturnValue(mockServers);
      
      const servers = manager.getMcpServers();
      
      expect(servers).toEqual(mockServers);
      expect(mockConfig.get).toHaveBeenCalledWith('mcp.servers', []);
    });
  });
  
  describe('isMcpEnabled', () => {
    it('should return true when MCP is enabled', () => {
      mockConfig.get.mockReturnValue(true);
      
      const enabled = manager.isMcpEnabled();
      
      expect(enabled).toBe(true);
      expect(mockConfig.get).toHaveBeenCalledWith('mcp.enabled', true);
    });
    
    it('should return false when MCP is disabled', () => {
      mockConfig.get.mockReturnValue(false);
      
      const enabled = manager.isMcpEnabled();
      
      expect(enabled).toBe(false);
    });
  });
  
  describe('updateMcpServer', () => {
    it('should add new server', async () => {
      const existingServers: MCPServerConfig[] = [
        { name: 'server1', transport: 'stdio', command: 'node', args: [] }
      ];
      
      const newServer: MCPServerConfig = {
        name: 'server2',
        transport: 'http',
        command: '',
        url: 'http://localhost:3000'
      };
      
      mockConfig.get.mockReturnValue(existingServers);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateMcpServer(newServer);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'mcp.servers',
        [...existingServers, newServer],
        1
      );
    });
    
    it('should update existing server', async () => {
      const existingServers: MCPServerConfig[] = [
        { name: 'server1', transport: 'stdio', command: 'node', args: [] },
        { name: 'server2', transport: 'http', command: '', url: 'http://localhost:3000' }
      ];
      
      const updatedServer: MCPServerConfig = {
        name: 'server1',
        transport: 'stdio',
        command: 'tsx',
        args: ['--watch']
      };
      
      mockConfig.get.mockReturnValue(existingServers);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateMcpServer(updatedServer);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'mcp.servers',
        [updatedServer, existingServers[1]],
        1
      );
    });
  });
  
  describe('removeMcpServer', () => {
    it('should remove server by name', async () => {
      const existingServers: MCPServerConfig[] = [
        { name: 'server1', transport: 'stdio', command: 'node', args: [] },
        { name: 'server2', transport: 'http', command: '', url: 'http://localhost:3000' }
      ];
      
      mockConfig.get.mockReturnValue(existingServers);
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.removeMcpServer('server1');
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'mcp.servers',
        [existingServers[1]],
        1
      );
    });
  });
  
  describe('setMcpEnabled', () => {
    it('should enable MCP', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.setMcpEnabled(true);
      
      expect(mockConfig.update).toHaveBeenCalledWith('mcp.enabled', true, 1);
    });
    
    it('should disable MCP', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.setMcpEnabled(false);
      
      expect(mockConfig.update).toHaveBeenCalledWith('mcp.enabled', false, 1);
    });
  });
  
  describe('getPermissionPolicy', () => {
    it('should return permission policy', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          'permissions.fileSystem.read': 'allow',
          'permissions.fileSystem.write': 'deny',
          'permissions.fileSystem.allowedPaths': ['/allowed'],
          'permissions.fileSystem.deniedPaths': ['/denied'],
          'permissions.terminal.execute': 'prompt',
          'permissions.terminal.allowedCommands': ['ls', 'pwd'],
          'permissions.terminal.deniedCommands': ['rm'],
          'permissions.mcp.toolCall': 'allow',
          'permissions.mcp.allowedTools': ['tool1'],
          'permissions.mcp.deniedTools': ['tool2']
        };
        return values[key] ?? defaultValue;
      });
      
      const policy = manager.getPermissionPolicy();
      
      expect(policy.fileSystem.read).toBe('allow');
      expect(policy.fileSystem.write).toBe('deny');
      expect(policy.fileSystem.allowedPaths).toEqual(['/allowed']);
      expect(policy.terminal.execute).toBe('prompt');
      expect(policy.terminal.allowedCommands).toEqual(['ls', 'pwd']);
      expect(policy.mcp.toolCall).toBe('allow');
    });
    
    it('should use default values', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => defaultValue);
      
      const policy = manager.getPermissionPolicy();
      
      expect(policy.fileSystem.read).toBe('prompt');
      expect(policy.fileSystem.write).toBe('prompt');
      expect(policy.terminal.execute).toBe('prompt');
      expect(policy.mcp.toolCall).toBe('prompt');
    });
  });
  
  describe('updatePermissionPolicy', () => {
    it('should update file system permissions', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updatePermissionPolicy('fs:*', {
        pattern: 'fs:*',
        action: 'allow',
        description: 'Allow file system access'
      });
      
      // The method should remove the old policy and add the new one
      expect(mockConfig.update).toHaveBeenCalled();
    });
    
    it('should update terminal permissions', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updatePermissionPolicy('terminal:*', {
        pattern: 'terminal:*',
        action: 'prompt',
        description: 'Prompt for terminal access'
      });
      
      expect(mockConfig.update).toHaveBeenCalled();
    });
    
    it('should update MCP permissions', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updatePermissionPolicy('mcp:*', {
        pattern: 'mcp:*',
        action: 'deny',
        description: 'Deny MCP tool calls'
      });
      
      expect(mockConfig.update).toHaveBeenCalled();
    });
    
    it('should only update provided fields', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updatePermissionPolicy('fs:read', {
        pattern: 'fs:read',
        action: 'allow'
      });
      
      expect(mockConfig.update).toHaveBeenCalled();
    });
  });
  
  describe('getSessionConfig', () => {
    it('should return session configuration', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          'session.maxMessages': 200,
          'session.persistHistory': false,
          'session.autoSave': false,
          'session.defaultMode': 'code'
        };
        return values[key] ?? defaultValue;
      });
      
      const config = manager.getSessionConfig();
      
      expect(config.maxMessages).toBe(200);
      expect(config.persistHistory).toBe(false);
      expect(config.autoSave).toBe(false);
      expect(config.defaultMode).toBe('code');
    });
  });
  
  describe('updateSessionConfig', () => {
    it('should update session configuration', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateSessionConfig({
        maxMessages: 150,
        persistHistory: false,
        autoSave: true,
        defaultMode: 'architect'
      });
      
      expect(mockConfig.update).toHaveBeenCalledWith('session.maxMessages', 150, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('session.persistHistory', false, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('session.autoSave', true, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('session.defaultMode', 'architect', 1);
    });
    
    it('should only update provided fields', async () => {
      mockConfig.update.mockResolvedValue(undefined);
      
      await manager.updateSessionConfig({
        maxMessages: 150
      });
      
      expect(mockConfig.update).toHaveBeenCalledWith('session.maxMessages', 150, 1);
      expect(mockConfig.update).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('onConfigurationChanged', () => {
    it('should register configuration change listener', () => {
      const callback = vi.fn();
      
      const disposable = manager.onConfigurationChanged(callback);
      
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
      expect(disposable).toBe(mockDisposable);
    });
    
    it('should call callback when ACP configuration changes', () => {
      const callback = vi.fn();
      
      manager.onConfigurationChanged(callback);
      
      // Get the registered callback
      const registeredCallback = (vscode as any).__mocks.getConfigChangeCallback();
      
      // Simulate configuration change for ACP
      const mockEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(true)
      };
      
      registeredCallback(mockEvent);
      
      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('acp');
      expect(callback).toHaveBeenCalledWith(mockEvent);
    });
    
    it('should not call callback when other configuration changes', () => {
      const callback = vi.fn();
      
      manager.onConfigurationChanged(callback);
      
      // Get the registered callback
      const registeredCallback = (vscode as any).__mocks.getConfigChangeCallback();
      
      // Simulate configuration change for other section
      const mockEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(false)
      };
      
      registeredCallback(mockEvent);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

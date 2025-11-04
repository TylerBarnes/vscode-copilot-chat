import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentProfileSelector } from '../../../src/platform/acp/agent-profile-selector';
import { ConfigurationManager } from '../../../src/platform/acp/configuration-manager';
import { AgentProfile } from '../../../src/platform/acp/types';

// Mock vscode module
vi.mock('vscode', () => {
  const mockStatusBarItem = {
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  };
  
  const mockWindow = {
    createStatusBarItem: vi.fn(() => mockStatusBarItem),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn()
  };
  
  return {
    window: mockWindow,
    StatusBarAlignment: {
      Left: 1,
      Right: 2
    },
    // Export internal mocks for test access
    __mockStatusBarItem: mockStatusBarItem,
    __mockWindow: mockWindow
  };
});

describe('AgentProfileSelector', () => {
  let selector: AgentProfileSelector;
  let mockConfigManager: ConfigurationManager;
  let vscode: any;
  let mockWindow: any;
  let mockStatusBarItem: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import vscode to get mocks
    vscode = await import('vscode');
    mockWindow = (vscode as any).__mockWindow;
    mockStatusBarItem = (vscode as any).__mockStatusBarItem;
    
    // Reset status bar item
    mockStatusBarItem.text = '';
    mockStatusBarItem.tooltip = '';
    mockStatusBarItem.command = '';
    
    // Create mock config manager
    mockConfigManager = {
      getAgentProfiles: vi.fn(() => []),
      updateAgentProfile: vi.fn(),
      removeAgentProfile: vi.fn()
    } as any;
    
    selector = new AgentProfileSelector(mockConfigManager);
  });
  
  afterEach(() => {
    selector.dispose();
  });
  
  describe('initialization', () => {
    it('should create status bar item', () => {
      expect(mockWindow.createStatusBarItem).toHaveBeenCalledWith(1, 100);
      expect(mockStatusBarItem.command).toBe('acp.selectAgentProfile');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });
    
    it('should show no agent in status bar initially', () => {
      expect(mockStatusBarItem.text).toBe('$(robot) No Agent');
      expect(mockStatusBarItem.tooltip).toBe('Click to select an agent profile');
    });
  });
  
  describe('selectProfile', () => {
    it('should prompt to create profile when none exist', async () => {
      mockConfigManager.getAgentProfiles = vi.fn(() => []);
      mockWindow.showInformationMessage.mockResolvedValue('Create Profile');
      mockWindow.showInputBox
        .mockResolvedValueOnce('test-agent')
        .mockResolvedValueOnce('/path/to/agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      const result = await selector.selectProfile();
      
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'No agent profiles configured',
        'Create Profile'
      );
      expect(result).toEqual({
        name: 'test-agent',
        executable: '/path/to/agent',
        args: [],
        env: {}
      });
    });
    
    it('should show quick pick with existing profiles', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: ['--verbose'], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showQuickPick.mockResolvedValue({ label: 'agent1' });
      
      const result = await selector.selectProfile();
      
      expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'agent1' }),
          expect.objectContaining({ label: 'agent2' }),
          expect.objectContaining({ label: '$(add) Create New Profile' })
        ]),
        expect.objectContaining({
          placeHolder: 'Select an agent profile'
        })
      );
      expect(result).toEqual(profiles[0]);
      expect(mockStatusBarItem.text).toBe('$(robot) agent1');
    });
    
    it('should handle create new profile option', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showQuickPick.mockResolvedValue({ label: '$(add) Create New Profile' });
      mockWindow.showInputBox
        .mockResolvedValueOnce('new-agent')
        .mockResolvedValueOnce('/path/new')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      const result = await selector.selectProfile();
      
      expect(result).toEqual({
        name: 'new-agent',
        executable: '/path/new',
        args: [],
        env: {}
      });
    });
    
    it('should handle cancellation', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showQuickPick.mockResolvedValue(undefined);
      
      const result = await selector.selectProfile();
      
      expect(result).toBeUndefined();
    });
  });
  
  describe('createProfile', () => {
    it('should create profile with all fields', async () => {
      mockWindow.showInputBox
        .mockResolvedValueOnce('test-agent')
        .mockResolvedValueOnce('/path/to/agent')
        .mockResolvedValueOnce('--arg1 value1 --arg2')
        .mockResolvedValueOnce('KEY1=value1,KEY2=value2');
      
      const result = await selector.createProfile();
      
      expect(result).toEqual({
        name: 'test-agent',
        executable: '/path/to/agent',
        args: ['--arg1', 'value1', '--arg2'],
        env: { KEY1: 'value1', KEY2: 'value2' }
      });
      expect(mockConfigManager.updateAgentProfile).toHaveBeenCalledWith(result);
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        "Agent profile 'test-agent' created successfully"
      );
    });
    
    it('should validate profile name', async () => {
      const existingProfiles: AgentProfile[] = [
        { name: 'existing', executable: '/path', args: [], env: {} }
      ];
      mockConfigManager.getAgentProfiles = vi.fn(() => existingProfiles);
      
      // First call with empty name
      const inputBox = mockWindow.showInputBox.mockImplementation(async (options: any) => {
        if (options.validateInput) {
          expect(options.validateInput('')).toBe('Profile name is required');
          expect(options.validateInput('existing')).toBe('Profile name already exists');
          expect(options.validateInput('new-name')).toBeUndefined();
        }
        return 'new-name';
      });
      
      mockWindow.showInputBox
        .mockResolvedValueOnce('new-name')
        .mockResolvedValueOnce('/path/to/agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      await selector.createProfile();
      
      expect(inputBox).toHaveBeenCalled();
    });
    
    it('should validate executable path', async () => {
      mockWindow.showInputBox
        .mockResolvedValueOnce('test-agent')
        .mockImplementationOnce(async (options: any) => {
          if (options.validateInput) {
            expect(options.validateInput('')).toBe('Executable path is required');
            expect(options.validateInput('/valid/path')).toBeUndefined();
          }
          return '/valid/path';
        })
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      await selector.createProfile();
      
      expect(mockWindow.showInputBox).toHaveBeenCalledTimes(4);
    });
    
    it('should handle cancellation at any step', async () => {
      mockWindow.showInputBox.mockResolvedValueOnce(undefined);
      
      const result = await selector.createProfile();
      
      expect(result).toBeUndefined();
      expect(mockConfigManager.updateAgentProfile).not.toHaveBeenCalled();
    });
    
    it('should parse environment variables correctly', async () => {
      mockWindow.showInputBox
        .mockResolvedValueOnce('test-agent')
        .mockResolvedValueOnce('/path/to/agent')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('KEY1=value1, KEY2 = value2 ,KEY3=value3');
      
      const result = await selector.createProfile();
      
      expect(result?.env).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3'
      });
    });
  });
  
  describe('editProfile', () => {
    it('should edit profile by name', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showInputBox
        .mockResolvedValueOnce('/new/path')
        .mockResolvedValueOnce('--new-arg')
        .mockResolvedValueOnce('NEW_KEY=new_value');
      
      const result = await selector.editProfile('agent1');
      
      expect(result).toEqual({
        name: 'agent1',
        executable: '/new/path',
        args: ['--new-arg'],
        env: { NEW_KEY: 'new_value' }
      });
      expect(mockConfigManager.updateAgentProfile).toHaveBeenCalledWith(result);
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        "Agent profile 'agent1' updated successfully"
      );
    });
    
    it('should show quick pick when no name provided', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showQuickPick.mockResolvedValue({ label: 'agent2' });
      mockWindow.showInputBox
        .mockResolvedValueOnce('/new/path')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      const result = await selector.editProfile();
      
      expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'agent1' }),
          expect.objectContaining({ label: 'agent2' })
        ]),
        expect.objectContaining({
          placeHolder: 'Select profile to edit'
        })
      );
      expect(result?.name).toBe('agent2');
    });
    
    it('should preserve existing values in input boxes', async () => {
      const profile: AgentProfile = {
        name: 'agent1',
        executable: '/path/1',
        args: ['--arg1', 'value1'],
        env: { KEY1: 'value1' }
      };
      
      mockConfigManager.getAgentProfiles = vi.fn(() => [profile]);
      
      let inputBoxCalls = 0;
      mockWindow.showInputBox.mockImplementation(async (options: any) => {
        inputBoxCalls++;
        if (inputBoxCalls === 1) {
          expect(options.value).toBe('/path/1');
          return '/path/1';
        } else if (inputBoxCalls === 2) {
          expect(options.value).toBe('--arg1 value1');
          return '--arg1 value1';
        } else if (inputBoxCalls === 3) {
          expect(options.value).toBe('KEY1=value1');
          return 'KEY1=value1';
        }
      });
      
      await selector.editProfile('agent1');
      
      expect(inputBoxCalls).toBe(3);
    });
    
    it('should update current profile if editing active one', async () => {
      const profile: AgentProfile = {
        name: 'agent1',
        executable: '/path/1',
        args: [],
        env: {}
      };
      
      mockConfigManager.getAgentProfiles = vi.fn(() => [profile]);
      selector.setCurrentProfile(profile);
      
      mockWindow.showInputBox
        .mockResolvedValueOnce('/new/path')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      
      await selector.editProfile('agent1');
      
      expect(selector.getCurrentProfile()?.executable).toBe('/new/path');
      expect(mockStatusBarItem.text).toBe('$(robot) agent1');
      expect(mockStatusBarItem.tooltip).toBe('Agent: /new/path');
    });
    
    it('should handle no profiles to edit', async () => {
      mockConfigManager.getAgentProfiles = vi.fn(() => []);
      
      const result = await selector.editProfile();
      
      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('No agent profiles to edit');
      expect(result).toBeUndefined();
    });
  });
  
  describe('deleteProfile', () => {
    it('should delete profile by name with confirmation', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showWarningMessage.mockResolvedValue('Delete');
      
      const result = await selector.deleteProfile('agent1');
      
      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
        "Delete agent profile 'agent1'?",
        { modal: true },
        'Delete'
      );
      expect(mockConfigManager.removeAgentProfile).toHaveBeenCalledWith('agent1');
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        "Agent profile 'agent1' deleted"
      );
      expect(result).toBe(true);
    });
    
    it('should show quick pick when no name provided', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} },
        { name: 'agent2', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showQuickPick.mockResolvedValue({ label: 'agent2' });
      mockWindow.showWarningMessage.mockResolvedValue('Delete');
      
      const result = await selector.deleteProfile();
      
      expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'agent1' }),
          expect.objectContaining({ label: 'agent2' })
        ]),
        expect.objectContaining({
          placeHolder: 'Select profile to delete'
        })
      );
      expect(mockConfigManager.removeAgentProfile).toHaveBeenCalledWith('agent2');
      expect(result).toBe(true);
    });
    
    it('should handle cancellation of confirmation', async () => {
      const profiles: AgentProfile[] = [
        { name: 'agent1', executable: '/path/1', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      mockWindow.showWarningMessage.mockResolvedValue(undefined);
      
      const result = await selector.deleteProfile('agent1');
      
      expect(mockConfigManager.removeAgentProfile).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should clear current profile if deleting active one', async () => {
      const profile: AgentProfile = {
        name: 'agent1',
        executable: '/path/1',
        args: [],
        env: {}
      };
      
      mockConfigManager.getAgentProfiles = vi.fn(() => [profile]);
      selector.setCurrentProfile(profile);
      mockWindow.showWarningMessage.mockResolvedValue('Delete');
      
      await selector.deleteProfile('agent1');
      
      expect(selector.getCurrentProfile()).toBeUndefined();
      expect(mockStatusBarItem.text).toBe('$(robot) No Agent');
    });
    
    it('should handle no profiles to delete', async () => {
      mockConfigManager.getAgentProfiles = vi.fn(() => []);
      
      const result = await selector.deleteProfile();
      
      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('No agent profiles to delete');
      expect(result).toBe(false);
    });
  });
  
  describe('validateProfile', () => {
    it('should validate required fields', () => {
      const profile1: AgentProfile = { name: '', executable: '/path', args: [], env: {} };
      const errors1 = selector.validateProfile(profile1);
      expect(errors1).toContain('Profile name is required');
      
      const profile2: AgentProfile = { name: 'test', executable: '', args: [], env: {} };
      const errors2 = selector.validateProfile(profile2);
      expect(errors2).toContain('Executable path is required');
      
      const profile3: AgentProfile = { name: '', executable: '', args: [], env: {} };
      const errors3 = selector.validateProfile(profile3);
      expect(errors3).toContain('Profile name is required');
      expect(errors3).toContain('Executable path is required');
    });
    
    it('should check for duplicate names', () => {
      const profiles: AgentProfile[] = [
        { name: 'duplicate', executable: '/path/1', args: [], env: {} },
        { name: 'duplicate', executable: '/path/2', args: [], env: {} }
      ];
      
      mockConfigManager.getAgentProfiles = vi.fn(() => profiles);
      
      const errors = selector.validateProfile(profiles[0]);
      expect(errors).toContain('Profile name must be unique');
    });
    
    it('should return empty array for valid profile', () => {
      const profile: AgentProfile = {
        name: 'valid',
        executable: '/path/to/agent',
        args: [],
        env: {}
      };
      
      mockConfigManager.getAgentProfiles = vi.fn(() => [profile]);
      
      const errors = selector.validateProfile(profile);
      expect(errors).toEqual([]);
    });
  });
  
  describe('getCurrentProfile / setCurrentProfile', () => {
    it('should get and set current profile', () => {
      expect(selector.getCurrentProfile()).toBeUndefined();
      
      const profile: AgentProfile = {
        name: 'test',
        executable: '/path',
        args: [],
        env: {}
      };
      
      selector.setCurrentProfile(profile);
      expect(selector.getCurrentProfile()).toEqual(profile);
      expect(mockStatusBarItem.text).toBe('$(robot) test');
      expect(mockStatusBarItem.tooltip).toBe('Agent: /path');
      
      selector.setCurrentProfile(undefined);
      expect(selector.getCurrentProfile()).toBeUndefined();
      expect(mockStatusBarItem.text).toBe('$(robot) No Agent');
    });
  });
  
  describe('dispose', () => {
    it('should dispose status bar item', () => {
      selector.dispose();
      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });
});
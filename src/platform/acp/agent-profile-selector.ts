import * as vscode from 'vscode';
import { AgentProfile } from './types';
import { ConfigurationManager } from './configuration-manager';

/**
 * Agent Profile Selector
 * Provides UI for selecting and managing agent profiles
 */
export class AgentProfileSelector {
  private currentProfile: AgentProfile | undefined;
  private statusBarItem: vscode.StatusBarItem;
  
  constructor(
    private configManager: ConfigurationManager
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'acp.selectAgentProfile';
    this.updateStatusBar();
  }
  
  /**
   * Show agent profile quick pick
   */
  async selectProfile(): Promise<AgentProfile | undefined> {
    const profiles = this.configManager.getAgentProfiles();
    
    if (profiles.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'No agent profiles configured',
        'Create Profile'
      );
      
      if (action === 'Create Profile') {
        return this.createProfile();
      }
      return undefined;
    }
    
    const items: vscode.QuickPickItem[] = profiles.map(profile => ({
      label: profile.name,
      description: profile.executable,
      detail: profile.args?.length ? `Args: ${profile.args.join(' ')}` : undefined
    }));
    
    // Add create new option
    items.push({
      label: '$(add) Create New Profile',
      description: 'Configure a new agent profile'
    });
    
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an agent profile',
      title: 'Agent Profile'
    });
    
    if (!selected) {
      return undefined;
    }
    
    if (selected.label.startsWith('$(add)')) {
      return this.createProfile();
    }
    
    const profile = profiles.find(p => p.name === selected.label);
    if (profile) {
      this.currentProfile = profile;
      this.updateStatusBar();
    }
    
    return profile;
  }
  
  /**
   * Create a new agent profile
   */
  async createProfile(): Promise<AgentProfile | undefined> {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter profile name',
      placeHolder: 'my-agent',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Profile name is required';
        }
        
        const existing = this.configManager.getAgentProfiles();
        if (existing.some(p => p.name === value)) {
          return 'Profile name already exists';
        }
        
        return undefined;
      }
    });
    
    if (!name) {
      return undefined;
    }
    
    const executable = await vscode.window.showInputBox({
      prompt: 'Enter agent executable path',
      placeHolder: '/path/to/agent',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Executable path is required';
        }
        return undefined;
      }
    });
    
    if (!executable) {
      return undefined;
    }
    
    const argsString = await vscode.window.showInputBox({
      prompt: 'Enter agent arguments (optional)',
      placeHolder: '--arg1 value1 --arg2 value2'
    });
    
    const args = argsString ? argsString.split(' ').filter(arg => arg.length > 0) : [];
    
    const envString = await vscode.window.showInputBox({
      prompt: 'Enter environment variables (optional)',
      placeHolder: 'KEY1=value1,KEY2=value2'
    });
    
    const env: Record<string, string> = {};
    if (envString) {
      envString.split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      });
    }
    
    const profile: AgentProfile = {
      name,
      executable,
      args,
      env
    };
    
    await this.configManager.updateAgentProfile(profile);
    this.currentProfile = profile;
    this.updateStatusBar();
    
    vscode.window.showInformationMessage(`Agent profile '${name}' created successfully`);
    
    return profile;
  }
  
  /**
   * Edit an existing agent profile
   */
  async editProfile(profileName?: string): Promise<AgentProfile | undefined> {
    const profiles = this.configManager.getAgentProfiles();
    
    if (profiles.length === 0) {
      vscode.window.showWarningMessage('No agent profiles to edit');
      return undefined;
    }
    
    let profile: AgentProfile | undefined;
    
    if (profileName) {
      profile = profiles.find(p => p.name === profileName);
    } else {
      const items = profiles.map(p => ({
        label: p.name,
        description: p.executable
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select profile to edit'
      });
      
      if (selected) {
        profile = profiles.find(p => p.name === selected.label);
      }
    }
    
    if (!profile) {
      return undefined;
    }
    
    const executable = await vscode.window.showInputBox({
      prompt: 'Enter agent executable path',
      value: profile.executable,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Executable path is required';
        }
        return undefined;
      }
    });
    
    if (!executable) {
      return undefined;
    }
    
    const argsString = await vscode.window.showInputBox({
      prompt: 'Enter agent arguments (optional)',
      value: profile.args?.join(' ')
    });
    
    const args = argsString ? argsString.split(' ').filter(arg => arg.length > 0) : [];
    
    const envPairs = Object.entries(profile.env || {}).map(([k, v]) => `${k}=${v}`).join(',');
    const envString = await vscode.window.showInputBox({
      prompt: 'Enter environment variables (optional)',
      value: envPairs
    });
    
    const env: Record<string, string> = {};
    if (envString) {
      envString.split(',').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      });
    }
    
    const updatedProfile: AgentProfile = {
      name: profile.name,
      executable,
      args,
      env
    };
    
    await this.configManager.updateAgentProfile(updatedProfile);
    
    if (this.currentProfile?.name === profile.name) {
      this.currentProfile = updatedProfile;
      this.updateStatusBar();
    }
    
    vscode.window.showInformationMessage(`Agent profile '${profile.name}' updated successfully`);
    
    return updatedProfile;
  }
  
  /**
   * Delete an agent profile
   */
  async deleteProfile(profileName?: string): Promise<boolean> {
    const profiles = this.configManager.getAgentProfiles();
    
    if (profiles.length === 0) {
      vscode.window.showWarningMessage('No agent profiles to delete');
      return false;
    }
    
    let profile: AgentProfile | undefined;
    
    if (profileName) {
      profile = profiles.find(p => p.name === profileName);
    } else {
      const items = profiles.map(p => ({
        label: p.name,
        description: p.executable
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select profile to delete'
      });
      
      if (selected) {
        profile = profiles.find(p => p.name === selected.label);
      }
    }
    
    if (!profile) {
      return false;
    }
    
    const confirm = await vscode.window.showWarningMessage(
      `Delete agent profile '${profile.name}'?`,
      { modal: true },
      'Delete'
    );
    
    if (confirm !== 'Delete') {
      return false;
    }
    
    await this.configManager.removeAgentProfile(profile.name);
    
    if (this.currentProfile?.name === profile.name) {
      this.currentProfile = undefined;
      this.updateStatusBar();
    }
    
    vscode.window.showInformationMessage(`Agent profile '${profile.name}' deleted`);
    
    return true;
  }
  
  /**
   * Get the current selected profile
   */
  getCurrentProfile(): AgentProfile | undefined {
    return this.currentProfile;
  }
  
  /**
   * Set the current profile
   */
  setCurrentProfile(profile: AgentProfile | undefined): void {
    this.currentProfile = profile;
    this.updateStatusBar();
  }
  
  /**
   * Validate a profile configuration
   */
  validateProfile(profile: AgentProfile): string[] {
    const errors: string[] = [];
    
    if (!profile.name || profile.name.trim().length === 0) {
      errors.push('Profile name is required');
    }
    
    if (!profile.executable || profile.executable.trim().length === 0) {
      errors.push('Executable path is required');
    }
    
    // Check for duplicate names
    const existing = this.configManager.getAgentProfiles();
    const duplicates = existing.filter(p => p.name === profile.name);
    if (duplicates.length > 1) {
      errors.push('Profile name must be unique');
    }
    
    return errors;
  }
  
  /**
   * Update status bar item
   */
  private updateStatusBar(): void {
    if (this.currentProfile) {
      this.statusBarItem.text = `$(robot) ${this.currentProfile.name}`;
      this.statusBarItem.tooltip = `Agent: ${this.currentProfile.executable}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = '$(robot) No Agent';
      this.statusBarItem.tooltip = 'Click to select an agent profile';
      this.statusBarItem.show();
    }
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration-manager';
import type { PermissionPolicy } from './types';

/**
 * Permission Policy Manager
 * 
 * Provides UI for managing permission policies for tool calls.
 * Allows users to configure auto-allow and auto-reject patterns.
 */
export class PermissionPolicyManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private configManager: ConfigurationManager
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'acp.managePermissions';
    this.updateStatusBar();
    this.statusBarItem.show();

    // Listen for configuration changes
    this.configManager.onConfigurationChanged(() => {
      this.updateStatusBar();
    });
  }

  /**
   * Update status bar to show permission policy count
   */
  private updateStatusBar(): void {
    const policies = this.configManager.getPermissionPolicies();
    const count = policies.length;
    this.statusBarItem.text = `$(shield) ${count} Permission ${count === 1 ? 'Policy' : 'Policies'}`;
    this.statusBarItem.tooltip = 'Manage ACP Permission Policies';
  }

  /**
   * Show permission policy management UI
   */
  async showManagementUI(): Promise<void> {
    const policies = this.configManager.getPermissionPolicies();

    const items: vscode.QuickPickItem[] = [
      {
        label: '$(add) Add Permission Policy',
        description: 'Create a new permission policy',
        alwaysShow: true
      },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      ...policies.map(policy => ({
        label: `$(shield) ${policy.pattern}`,
        description: policy.action === 'allow' ? '✓ Auto-Allow' : '✗ Auto-Reject',
        detail: policy.description
      }))
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a permission policy to manage',
      title: 'ACP Permission Policies'
    });

    if (!selected) {
      return;
    }

    if (selected.label.includes('Add Permission Policy')) {
      await this.addPolicy();
    } else {
      // Extract pattern from label (remove icon and spaces)
      const pattern = selected.label.replace(/^\$\([^)]+\)\s*/, '');
      const policy = policies.find(p => p.pattern === pattern);
      if (policy) {
        await this.managePolicy(policy);
      }
    }
  }

  /**
   * Add a new permission policy
   */
  private async addPolicy(): Promise<void> {
    // Get pattern
    const pattern = await vscode.window.showInputBox({
      prompt: 'Enter tool call pattern (e.g., "fs:*", "terminal:execute")',
      placeHolder: 'fs:*',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Pattern cannot be empty';
        }
        if (!/^[a-zA-Z0-9_*:]+$/.test(value)) {
          return 'Pattern can only contain letters, numbers, underscores, colons, and asterisks';
        }
        return null;
      }
    });

    if (!pattern) {
      return;
    }

    // Get action
    const actionItems: vscode.QuickPickItem[] = [
      {
        label: '$(check) Auto-Allow',
        description: 'Automatically allow matching tool calls',
        detail: 'Tool calls matching this pattern will be executed without prompting'
      },
      {
        label: '$(x) Auto-Reject',
        description: 'Automatically reject matching tool calls',
        detail: 'Tool calls matching this pattern will be rejected without prompting'
      }
    ];

    const actionSelected = await vscode.window.showQuickPick(actionItems, {
      placeHolder: 'Select action for this pattern',
      title: `Permission Policy: ${pattern}`
    });

    if (!actionSelected) {
      return;
    }

    const action = actionSelected.label.includes('Auto-Allow') ? 'allow' : 'deny';

    // Get optional description
    const description = await vscode.window.showInputBox({
      prompt: 'Enter optional description',
      placeHolder: 'Allow all file system operations'
    });

    const policy: PermissionPolicy = {
      pattern,
      action,
      description
    };

    await this.configManager.addPermissionPolicy(policy);
    vscode.window.showInformationMessage(`Permission policy added: ${pattern}`);

    // Show management UI again
    await this.showManagementUI();
  }

  /**
   * Manage an existing permission policy
   */
  private async managePolicy(policy: PermissionPolicy): Promise<void> {
    const items: vscode.QuickPickItem[] = [
      {
        label: '$(edit) Edit Description',
        description: 'Update policy description'
      },
      {
        label: '$(sync) Toggle Action',
        description: `Change to ${policy.action === 'allow' ? 'Auto-Reject' : 'Auto-Allow'}`
      },
      {
        label: '$(trash) Delete Policy',
        description: 'Remove this permission policy'
      }
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Manage policy: ${policy.pattern}`,
      title: 'Permission Policy Options'
    });

    if (!selected) {
      return;
    }

    if (selected.label.includes('Edit Description')) {
      await this.editPolicyDescription(policy);
    } else if (selected.label.includes('Toggle Action')) {
      await this.togglePolicyAction(policy);
    } else if (selected.label.includes('Delete Policy')) {
      await this.deletePolicy(policy);
    }

    // Show management UI again
    await this.showManagementUI();
  }

  /**
   * Edit policy description
   */
  private async editPolicyDescription(policy: PermissionPolicy): Promise<void> {
    const description = await vscode.window.showInputBox({
      prompt: 'Enter new description',
      value: policy.description,
      placeHolder: 'Allow all file system operations'
    });

    if (description === undefined) {
      return;
    }

    const updatedPolicy: PermissionPolicy = {
      ...policy,
      description
    };

    await this.configManager.updatePermissionPolicy(policy.pattern, updatedPolicy);
    vscode.window.showInformationMessage(`Policy description updated: ${policy.pattern}`);
  }

  /**
   * Toggle policy action between allow and reject
   */
  private async togglePolicyAction(policy: PermissionPolicy): Promise<void> {
    const newAction = policy.action === 'allow' ? 'deny' : 'allow';
    const updatedPolicy: PermissionPolicy = {
      ...policy,
      action: newAction
    };

    await this.configManager.updatePermissionPolicy(policy.pattern, updatedPolicy);
    vscode.window.showInformationMessage(
      `Policy action changed to ${newAction === 'allow' ? 'Auto-Allow' : 'Auto-Reject'}: ${policy.pattern}`
    );
  }

  /**
   * Delete a permission policy
   */
  private async deletePolicy(policy: PermissionPolicy): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Delete permission policy "${policy.pattern}"?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      return;
    }

    await this.configManager.removePermissionPolicy(policy.pattern);
    vscode.window.showInformationMessage(`Permission policy deleted: ${policy.pattern}`);
  }

  /**
   * Check if a tool call matches any permission policy
   */
  checkPermission(toolName: string): 'allow' | 'reject' | 'prompt' {
    const policies = this.configManager.getPermissionPolicies();

    for (const policy of policies) {
      if (this.matchesPattern(toolName, policy.pattern)) {
        // Map 'deny' to 'reject' for compatibility
        return policy.action === 'deny' ? 'reject' : policy.action;
      }
    }

    return 'prompt';
  }

  /**
   * Check if a tool name matches a pattern
   * Supports wildcards: "fs:*" matches "fs:read", "fs:write", etc.
   */
  private matchesPattern(toolName: string, pattern: string): boolean {
    // Exact match
    if (toolName === pattern) {
      return true;
    }

    // Wildcard match
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/:/g, '\\:');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(toolName);
    }

    return false;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

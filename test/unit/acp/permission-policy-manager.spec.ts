import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionPolicyManager } from '../../../src/platform/acp/permission-policy-manager';
import { ConfigurationManager } from '../../../src/platform/acp/configuration-manager';
import { PermissionPolicy } from '../../../src/platform/acp/types';

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
    StatusBarAlignment: { Right: 2 },
    QuickPickItemKind: { Separator: -1 },
    __mockStatusBarItem: mockStatusBarItem,
    __mockWindow: mockWindow
  };
});

describe('PermissionPolicyManager', () => {
  let manager: PermissionPolicyManager;
  let mockConfigManager: ConfigurationManager;
  let configChangeCallback: (() => void) | undefined;
  let mockStatusBarItem: any;
  let mockWindow: any;

  beforeEach(async () => {
    // Import vscode mock
    const vscode = await import('vscode');
    mockStatusBarItem = (vscode as any).__mockStatusBarItem;
    mockWindow = (vscode as any).__mockWindow;

    // Reset mocks
    vi.clearAllMocks();
    mockStatusBarItem.text = '';
    mockStatusBarItem.tooltip = '';
    mockStatusBarItem.command = '';
    
    // Reset window mocks explicitly
    mockWindow.showQuickPick.mockReset();
    mockWindow.showInputBox.mockReset();
    mockWindow.showInformationMessage.mockReset();
    mockWindow.showWarningMessage.mockReset();

    // Create mock config manager
    mockConfigManager = {
      getPermissionPolicies: vi.fn(() => []),
      addPermissionPolicy: vi.fn(),
      updatePermissionPolicy: vi.fn(),
      removePermissionPolicy: vi.fn(),
      onConfigurationChanged: vi.fn((callback) => {
        configChangeCallback = callback;
        return { dispose: vi.fn() };
      })
    } as any;

    manager = new PermissionPolicyManager(mockConfigManager);
  });

  describe('constructor', () => {
    it('should create status bar item', () => {
      expect(mockWindow.createStatusBarItem).toHaveBeenCalledWith(2, 100);
      expect(mockStatusBarItem.command).toBe('acp.managePermissions');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should update status bar with policy count', () => {
      expect(mockStatusBarItem.text).toBe('$(shield) 0 Permission Policies');
      expect(mockStatusBarItem.tooltip).toBe('Manage ACP Permission Policies');
    });

    it('should listen for configuration changes', () => {
      expect(mockConfigManager.onConfigurationChanged).toHaveBeenCalled();
    });

    it('should update status bar on configuration change', () => {
      // Setup mock to return policies
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: 'fs:*', action: 'allow' }
      ]);

      // Trigger config change
      configChangeCallback?.();

      expect(mockStatusBarItem.text).toBe('$(shield) 1 Permission Policy');
    });
  });

  describe('showManagementUI', () => {
    it('should show quick pick with add option', async () => {
      mockWindow.showQuickPick.mockResolvedValue(undefined);

      await manager.showManagementUI();

      expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: '$(add) Add Permission Policy'
          })
        ]),
        expect.objectContaining({
          placeHolder: 'Select a permission policy to manage'
        })
      );
    });

    it('should show existing policies', async () => {
      const policies: PermissionPolicy[] = [
        { pattern: 'fs:*', action: 'allow', description: 'Allow file system' },
        { pattern: 'terminal:*', action: 'deny', description: 'Deny terminal' }
      ];
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue(policies);

      mockWindow.showQuickPick.mockResolvedValue(undefined);

      await manager.showManagementUI();

      expect(mockWindow.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: '$(shield) fs:*',
            description: '✓ Auto-Allow',
            detail: 'Allow file system'
          }),
          expect.objectContaining({
            label: '$(shield) terminal:*',
            description: '✗ Auto-Reject',
            detail: 'Deny terminal'
          })
        ]),
        expect.any(Object)
      );
    });

    it('should handle add policy selection', async () => {
      // First QuickPick: Select "Add Permission Policy"
      // Then InputBox: Enter pattern
      // Then QuickPick: Select action
      // Then InputBox: Enter description
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' })
        .mockResolvedValueOnce({ label: '$(check) Auto-Allow' });
      mockWindow.showInputBox
        .mockResolvedValueOnce('fs:read') // pattern
        .mockResolvedValueOnce('Allow read'); // description

      await manager.showManagementUI();

      expect(mockConfigManager.addPermissionPolicy).toHaveBeenCalledWith({
        pattern: 'fs:read',
        action: 'allow',
        description: 'Allow read'
      });
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Permission policy added: fs:read'
      );
    });

    it('should handle manage policy selection', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' }) // Select policy
        .mockResolvedValueOnce(undefined); // Cancel manage options

      await manager.showManagementUI();

      // Should show manage options (second call to showQuickPick)
      expect(mockWindow.showQuickPick).toHaveBeenCalledTimes(2);
      const secondCall = mockWindow.showQuickPick.mock.calls[1];
      expect(secondCall[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: '$(edit) Edit Description' }),
          expect.objectContaining({ label: '$(sync) Toggle Action' }),
          expect.objectContaining({ label: '$(trash) Delete Policy' })
        ])
      );
    });
  });

  describe('addPolicy', () => {
    it('should validate pattern input', async () => {
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' });
      mockWindow.showInputBox.mockResolvedValueOnce(undefined); // Cancel pattern input

      await manager.showManagementUI();

      const inputBoxCall = mockWindow.showInputBox.mock.calls[0];
      const options = inputBoxCall[0];
      expect(options.validateInput).toBeDefined();
      const validateInput = options.validateInput!;
      expect(validateInput('')).toBe('Pattern cannot be empty');
      expect(validateInput('invalid pattern!')).toBe(
        'Pattern can only contain letters, numbers, underscores, colons, and asterisks'
      );
      expect(validateInput('fs:*')).toBeNull();
    });

    it('should add allow policy', async () => {
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' })
        .mockResolvedValueOnce({ label: '$(check) Auto-Allow' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox
        .mockResolvedValueOnce('fs:*')
        .mockResolvedValueOnce('Allow all file operations');

      await manager.showManagementUI();

      expect(mockConfigManager.addPermissionPolicy).toHaveBeenCalledWith({
        pattern: 'fs:*',
        action: 'allow',
        description: 'Allow all file operations'
      });
    });

    it('should add deny policy', async () => {
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' })
        .mockResolvedValueOnce({ label: '$(x) Auto-Reject' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox
        .mockResolvedValueOnce('terminal:*')
        .mockResolvedValueOnce('Reject all terminal operations');

      await manager.showManagementUI();

      expect(mockConfigManager.addPermissionPolicy).toHaveBeenCalledWith({
        pattern: 'terminal:*',
        action: 'deny',
        description: 'Reject all terminal operations'
      });
    });

    it('should handle cancellation at pattern input', async () => {
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox.mockResolvedValueOnce(undefined);

      await manager.showManagementUI();

      expect(mockConfigManager.addPermissionPolicy).not.toHaveBeenCalled();
    });

    it('should handle cancellation at action selection', async () => {
      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(add) Add Permission Policy' })
        .mockResolvedValueOnce(undefined) // Cancel action selection
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox.mockResolvedValueOnce('fs:*');

      await manager.showManagementUI();

      expect(mockConfigManager.addPermissionPolicy).not.toHaveBeenCalled();
    });
  });

  describe('managePolicy', () => {
    it('should edit policy description', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow', description: 'Old' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' })
        .mockResolvedValueOnce({ label: '$(edit) Edit Description' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox.mockResolvedValueOnce('New description');

      await manager.showManagementUI();

      expect(mockConfigManager.updatePermissionPolicy).toHaveBeenCalledWith('fs:*', {
        pattern: 'fs:*',
        action: 'allow',
        description: 'New description'
      });
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Policy description updated: fs:*'
      );
    });

    it('should toggle policy action from allow to deny', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' })
        .mockResolvedValueOnce({ label: '$(sync) Toggle Action' })
        .mockResolvedValueOnce(undefined);

      await manager.showManagementUI();

      expect(mockConfigManager.updatePermissionPolicy).toHaveBeenCalledWith('fs:*', {
        pattern: 'fs:*',
        action: 'deny'
      });
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Policy action changed to Auto-Reject: fs:*'
      );
    });

    it('should toggle policy action from deny to allow', async () => {
      const policy: PermissionPolicy = { pattern: 'terminal:*', action: 'deny' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) terminal:*' })
        .mockResolvedValueOnce({ label: '$(sync) Toggle Action' })
        .mockResolvedValueOnce(undefined);

      await manager.showManagementUI();

      expect(mockConfigManager.updatePermissionPolicy).toHaveBeenCalledWith('terminal:*', {
        pattern: 'terminal:*',
        action: 'allow'
      });
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Policy action changed to Auto-Allow: terminal:*'
      );
    });

    it('should delete policy with confirmation', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' })
        .mockResolvedValueOnce({ label: '$(trash) Delete Policy' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showWarningMessage.mockResolvedValueOnce('Delete');

      await manager.showManagementUI();

      expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
        'Delete permission policy "fs:*"?',
        { modal: true },
        'Delete'
      );
      expect(mockConfigManager.removePermissionPolicy).toHaveBeenCalledWith('fs:*');
      expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
        'Permission policy deleted: fs:*'
      );
    });

    it('should not delete policy if not confirmed', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' })
        .mockResolvedValueOnce({ label: '$(trash) Delete Policy' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showWarningMessage.mockResolvedValueOnce(undefined);

      await manager.showManagementUI();

      expect(mockConfigManager.removePermissionPolicy).not.toHaveBeenCalled();
    });

    it('should handle cancellation at description edit', async () => {
      const policy: PermissionPolicy = { pattern: 'fs:*', action: 'allow' };
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([policy]);

      mockWindow.showQuickPick
        .mockResolvedValueOnce({ label: '$(shield) fs:*' })
        .mockResolvedValueOnce({ label: '$(edit) Edit Description' })
        .mockResolvedValueOnce(undefined);
      mockWindow.showInputBox.mockResolvedValueOnce(undefined);

      await manager.showManagementUI();

      expect(mockConfigManager.updatePermissionPolicy).not.toHaveBeenCalled();
    });
  });

  describe('checkPermission', () => {
    it('should return prompt when no policies match', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([]);

      const result = manager.checkPermission('fs:read');

      expect(result).toBe('prompt');
    });

    it('should return allow for exact match', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: 'fs:read', action: 'allow' }
      ]);

      const result = manager.checkPermission('fs:read');

      expect(result).toBe('allow');
    });

    it('should return deny for exact match', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: 'terminal:execute', action: 'deny' }
      ]);

      const result = manager.checkPermission('terminal:execute');

      expect(result).toBe('reject');
    });

    it('should match wildcard patterns', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: 'fs:*', action: 'allow' }
      ]);

      expect(manager.checkPermission('fs:read')).toBe('allow');
      expect(manager.checkPermission('fs:write')).toBe('allow');
      expect(manager.checkPermission('fs:delete')).toBe('allow');
      expect(manager.checkPermission('terminal:execute')).toBe('prompt');
    });

    it('should match complex wildcard patterns', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: '*:read', action: 'allow' }
      ]);

      expect(manager.checkPermission('fs:read')).toBe('allow');
      expect(manager.checkPermission('db:read')).toBe('allow');
      expect(manager.checkPermission('fs:write')).toBe('prompt');
    });

    it('should use first matching policy', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: 'fs:*', action: 'deny' },
        { pattern: 'fs:read', action: 'allow' }
      ]);

      // First policy should match
      expect(manager.checkPermission('fs:read')).toBe('reject');
    });

    it('should match full wildcard', () => {
      vi.mocked(mockConfigManager.getPermissionPolicies).mockReturnValue([
        { pattern: '*', action: 'allow' }
      ]);

      expect(manager.checkPermission('fs:read')).toBe('allow');
      expect(manager.checkPermission('terminal:execute')).toBe('allow');
      expect(manager.checkPermission('anything')).toBe('allow');
    });
  });

  describe('dispose', () => {
    it('should dispose status bar item', () => {
      manager.dispose();

      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { SessionModeSwitcher } from '../../../src/platform/acp/session-mode-switcher';
import type { SessionModes } from '../../../src/platform/acp/types';

interface SessionModeQuickPickItem extends vscode.QuickPickItem {
    mode: string;
}

vi.mock('vscode', () => ({
    window: {
        createStatusBarItem: vi.fn(),
        showQuickPick: vi.fn(),
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },
}));

describe('SessionModeSwitcher', () => {
    let switcher: SessionModeSwitcher;
    let mockStatusBarItem: any;
    let mockOnModeChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockOnModeChange = vi.fn();
        
        mockStatusBarItem = {
            text: '',
            tooltip: '',
            command: '',
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn(),
        };

        vi.mocked(vscode.window.createStatusBarItem).mockReturnValue(mockStatusBarItem);

        switcher = new SessionModeSwitcher(mockOnModeChange);
    });

    describe('initialization', () => {
        it('should create status bar item on construction', () => {
            expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
                vscode.StatusBarAlignment.Left,
                100
            );
        });

        it('should set default status bar text', () => {
            expect(mockStatusBarItem.text).toBe('$(symbol-method) No Mode');
        });

        it('should set status bar tooltip', () => {
            expect(mockStatusBarItem.tooltip).toBe('Click to change session mode');
        });

        it('should register click command', () => {
            expect(mockStatusBarItem.command).toBe('acp.selectSessionMode');
        });

        it('should show status bar item', () => {
            expect(mockStatusBarItem.show).toHaveBeenCalled();
        });
    });

    describe('updateModes', () => {
        it('should update available modes', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode' },
                    { name: 'code', description: 'Code mode' },
                ],
                currentMode: 'chat',
            };

            switcher.updateModes(modes);

            expect(switcher.getAvailableModes()).toEqual(modes.availableModes);
            expect(switcher.getCurrentMode()).toBe('chat');
        });

        it('should update status bar text with current mode', () => {
            const modes: SessionModes = {
                availableModes: [{ name: 'debug', description: 'Debug mode' }],
                currentMode: 'debug',
            };

            switcher.updateModes(modes);

            expect(mockStatusBarItem.text).toBe('$(symbol-method) debug');
        });

        it('should handle empty modes', () => {
            const modes: SessionModes = {
                availableModes: [],
                currentMode: '',
            };

            switcher.updateModes(modes);

            expect(mockStatusBarItem.text).toBe('$(symbol-method) No Mode');
        });

        it('should update status bar with icon if provided', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode', icon: '💬' },
                ],
                currentMode: 'chat',
            };

            switcher.updateModes(modes);

            expect(mockStatusBarItem.text).toBe('💬 chat');
        });
    });

    describe('selectMode', () => {
        beforeEach(() => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode', icon: '💬' },
                    { name: 'code', description: 'Code mode', icon: '💻' },
                    { name: 'debug', description: 'Debug mode', icon: '🐛' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);
        });

        it('should show quick pick with available modes', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

            await switcher.selectMode();

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                [
                    { label: '💬 chat', description: 'Chat mode', mode: 'chat' },
                    { label: '💻 code', description: 'Code mode', mode: 'code' },
                    { label: '🐛 debug', description: 'Debug mode', mode: 'debug' },
                ],
                { placeHolder: 'Select session mode' }
            );
        });

        it('should call onModeChange when mode is selected', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
                label: '💻 code',
                description: 'Code mode',
                mode: 'code',
            } as SessionModeQuickPickItem);

            await switcher.selectMode();

            expect(mockOnModeChange).toHaveBeenCalledWith('code');
        });

        it('should not call onModeChange if selection is cancelled', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

            await switcher.selectMode();

            expect(mockOnModeChange).not.toHaveBeenCalled();
        });

        it('should not call onModeChange if same mode is selected', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
                label: '💬 chat',
                description: 'Chat mode',
                mode: 'chat',
            } as SessionModeQuickPickItem);

            await switcher.selectMode();

            expect(mockOnModeChange).not.toHaveBeenCalled();
        });

        it('should update status bar after mode change', async () => {
            vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
                label: '💻 code',
                description: 'Code mode',
                mode: 'code',
            } as SessionModeQuickPickItem);

            await switcher.selectMode();

            expect(mockStatusBarItem.text).toBe('💻 code');
        });

        it('should handle modes without icons', async () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode' },
                    { name: 'code', description: 'Code mode' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
                label: 'code',
                description: 'Code mode',
                mode: 'code',
            } as SessionModeQuickPickItem);

            await switcher.selectMode();

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                [
                    { label: 'chat', description: 'Chat mode', mode: 'chat' },
                    { label: 'code', description: 'Code mode', mode: 'code' },
                ],
                { placeHolder: 'Select session mode' }
            );
        });
    });

    describe('setCurrentMode', () => {
        it('should update current mode', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode' },
                    { name: 'code', description: 'Code mode' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            switcher.setCurrentMode('code');

            expect(switcher.getCurrentMode()).toBe('code');
        });

        it('should update status bar text', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode', icon: '💬' },
                    { name: 'code', description: 'Code mode', icon: '💻' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            switcher.setCurrentMode('code');

            expect(mockStatusBarItem.text).toBe('💻 code');
        });

        it('should handle mode not in available modes', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            switcher.setCurrentMode('unknown');

            expect(mockStatusBarItem.text).toBe('$(symbol-method) unknown');
        });
    });

    describe('dispose', () => {
        it('should dispose status bar item', () => {
            switcher.dispose();

            expect(mockStatusBarItem.dispose).toHaveBeenCalled();
        });

        it('should hide status bar item', () => {
            switcher.dispose();

            expect(mockStatusBarItem.hide).toHaveBeenCalled();
        });
    });

    describe('getters', () => {
        it('should return available modes', () => {
            const modes: SessionModes = {
                availableModes: [
                    { name: 'chat', description: 'Chat mode' },
                    { name: 'code', description: 'Code mode' },
                ],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            expect(switcher.getAvailableModes()).toEqual(modes.availableModes);
        });

        it('should return current mode', () => {
            const modes: SessionModes = {
                availableModes: [{ name: 'chat', description: 'Chat mode' }],
                currentMode: 'chat',
            };
            switcher.updateModes(modes);

            expect(switcher.getCurrentMode()).toBe('chat');
        });

        it('should return empty array for available modes initially', () => {
            expect(switcher.getAvailableModes()).toEqual([]);
        });

        it('should return empty string for current mode initially', () => {
            expect(switcher.getCurrentMode()).toBe('');
        });
    });
});

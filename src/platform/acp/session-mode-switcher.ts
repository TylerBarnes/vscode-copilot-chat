import * as vscode from 'vscode';
import type { SessionMode, SessionModes } from './types';

/**
 * Quick pick item for session mode selection
 */
interface SessionModeQuickPickItem extends vscode.QuickPickItem {
    mode: string;
}

/**
 * SessionModeSwitcher manages the session mode UI and user interaction
 * Displays current mode in status bar and allows switching between modes
 */
export class SessionModeSwitcher {
    private statusBarItem: vscode.StatusBarItem;
    private availableModes: SessionMode[] = [];
    private currentMode: string = '';
    private onModeChange: (mode: string) => void;

    constructor(onModeChange: (mode: string) => void) {
        this.onModeChange = onModeChange;
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        
        this.statusBarItem.text = '$(symbol-method) No Mode';
        this.statusBarItem.tooltip = 'Click to change session mode';
        this.statusBarItem.command = 'acp.selectSessionMode';
        this.statusBarItem.show();
    }

    /**
     * Update available modes and current mode
     */
    updateModes(modes: SessionModes): void {
        this.availableModes = modes.availableModes;
        this.currentMode = modes.currentMode;
        this.updateStatusBar();
    }

    /**
     * Set the current mode
     */
    setCurrentMode(mode: string): void {
        this.currentMode = mode;
        this.updateStatusBar();
    }

    /**
     * Show quick pick to select a mode
     */
    async selectMode(): Promise<void> {
        const items: SessionModeQuickPickItem[] = this.availableModes.map(mode => ({
            label: mode.icon ? `${mode.icon} ${mode.name}` : mode.name,
            description: mode.description,
            mode: mode.name,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select session mode',
        });

        if (selected && selected.mode !== this.currentMode) {
            this.currentMode = selected.mode;
            this.updateStatusBar();
            this.onModeChange(selected.mode);
        }
    }

    /**
     * Get available modes
     */
    getAvailableModes(): SessionMode[] {
        return this.availableModes;
    }

    /**
     * Get current mode
     */
    getCurrentMode(): string {
        return this.currentMode;
    }

    /**
     * Update status bar text based on current mode
     */
    private updateStatusBar(): void {
        if (!this.currentMode) {
            this.statusBarItem.text = '$(symbol-method) No Mode';
            return;
        }

        const mode = this.availableModes.find(m => m.name === this.currentMode);
        if (mode?.icon) {
            this.statusBarItem.text = `${mode.icon} ${this.currentMode}`;
        } else {
            this.statusBarItem.text = `$(symbol-method) ${this.currentMode}`;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.statusBarItem.hide();
        this.statusBarItem.dispose();
    }
}

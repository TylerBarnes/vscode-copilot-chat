/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICopilotTokenManager, CopilotTokenType } from '../authentication/common/copilotTokenManager';
import { CancellationToken } from 'vscode';
import { Event } from '../../util/vs/base/common/event';

/**
 * Stub implementation of ICopilotTokenManager for ACP.
 * ACP agents handle their own authentication via the ACP protocol,
 * so this stub returns null tokens to satisfy the interface.
 */
export class StubTokenManager implements ICopilotTokenManager {
    readonly _serviceBrand: undefined;

    // Event that never fires since ACP doesn't use token refresh
    readonly onDidCopilotTokenRefresh: Event<void> = Event.None;

    async getCopilotToken(
        type: CopilotTokenType,
        force?: boolean,
        token?: CancellationToken
    ): Promise<string | null> {
        // ACP doesn't need GitHub Copilot tokens
        return null;
    }

    async checkCopilotToken(token?: CancellationToken): Promise<{ status: 'OK' | 'NotSignedIn' | 'NotAuthorized' | 'FailedToRefresh' }> {
        // Always return NotSignedIn since ACP doesn't use GitHub auth
        return { status: 'NotSignedIn' };
    }

    async resetCopilotToken(type: CopilotTokenType, reason?: string): Promise<void> {
        // No-op for ACP
    }

    async getGitHubToken(force?: boolean, token?: CancellationToken): Promise<string | null> {
        // ACP doesn't need GitHub tokens
        return null;
    }

    async getGitHubSession(force?: boolean, token?: CancellationToken): Promise<any | null> {
        // ACP doesn't need GitHub sessions
        return null;
    }

    dispose(): void {
        // No resources to dispose
    }
}
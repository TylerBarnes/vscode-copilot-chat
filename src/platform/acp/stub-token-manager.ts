/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vscode';
import { Event } from '../../util/vs/base/common/event';
import { createServiceIdentifier } from '../../util/common/services';

// Define the interface locally since authentication directory was deleted
export enum CopilotTokenType {
    Github = 'github',
    GithubEnterprise = 'github-enterprise',
}

export interface ICopilotTokenManager {
    readonly _serviceBrand: undefined;
    readonly onDidCopilotTokenRefresh: Event<void>;
    getCopilotToken(type: CopilotTokenType, force?: boolean, token?: CancellationToken): Promise<string | null>;
    checkCopilotToken(token?: CancellationToken): Promise<{ status: 'OK' | 'NotSignedIn' | 'NotAuthorized' | 'FailedToRefresh' }>;
    resetCopilotToken(type: CopilotTokenType, reason?: string): Promise<void>;
    getGitHubToken(force?: boolean, token?: CancellationToken): Promise<string | null>;
    getGitHubSession(force?: boolean, token?: CancellationToken): Promise<any | null>;
    dispose(): void;
}

export const ICopilotTokenManager = createServiceIdentifier<ICopilotTokenManager>('ICopilotTokenManager');

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
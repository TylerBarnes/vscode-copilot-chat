/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ACPContribution } from '../../../platform/acp/acp.contribution';
import { IExtensionContributionFactory, asContributionFactory } from '../../common/contributions';
// Removed ContextKeysContribution (proprietary - depends on deleted authentication/telemetry)
import vscodeContributions from '../vscode/contributions';

// ###################################################################################################
// ###                                                                                             ###
// ###                   Node contributions run ONLY in node.js extension host.                    ###
// ###                                                                                             ###
// ### !!! Prefer to list contributions in ../vscode/contributions.ts to support them anywhere !!! ###
// ###                                                                                             ###
// ###################################################################################################
//
// ACP Transformation Phase 1: All proprietary GitHub Copilot contributions have been removed.
// Only ACP-compatible contributions remain:
// - ACPContribution: Core ACP client functionality (JSON-RPC, agent communication, protocol)
// - ContextKeysContribution: Simplified context key management (renamed to acp.copilot.*)
//
// Removed contributions (50+ total):
// - All chat/completion/inline edit features (ConversationFeature, CompletionsCoreContribution, etc.)
// - All authentication/token management (AuthenticationContrib)
// - All telemetry (LifecycleTelemetryContrib, GithubTelemetryForwardingContrib, etc.)
// - All tools/related files (ToolsContribution, RelatedFilesProviderContribution)
// - All proprietary VS Code API integrations (LanguageModelAccess, InlineCompletionContribution, etc.)
// - All notebook/testing/debugging features
// - All workspace indexing/search features
// - All BYOK/external agent features
//
// These will be replaced with ACP-native implementations in subsequent phases.

export const vscodeNodeContributions: IExtensionContributionFactory[] = [
    ...vscodeContributions,
    asContributionFactory(ACPContribution),
    // Removed ContextKeysContribution (proprietary - depends on deleted authentication/telemetry)
];

/**
 * ACP Transformation: Chat-specific contributions are no longer needed.
 * All chat functionality is now handled through the ACP protocol.
 */
export const vscodeNodeChatContributions: IExtensionContributionFactory[] = [
    // All proprietary chat contributions removed for ACP compatibility
];

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Commands ending with "Client" refer to the command ID used in the legacy Copilot extension.
// - These IDs should not appear in the package.json file
// - These IDs should be registered to support all functionality (except if this command needs to be supported when both extensions are loaded/active).
// Commands ending with "Chat" refer to the command ID used in the Copilot Chat extension.
// - These IDs should be used in package.json
// - These IDs should only be registered if they appear in the package.json (meaning the command palette) or if the command needs to be supported when both extensions are loaded/active.

export const CMDOpenPanelClient = 'acp.copilot.generate';
export const CMDOpenPanelChat = 'acp.copilot.chat.openSuggestionsPanel'; // "acp.copilot.chat.generate" is already being used

export const CMDAcceptCursorPanelSolutionClient = 'acp.copilot.acceptCursorPanelSolution';
export const CMDNavigatePreviousPanelSolutionClient = 'acp.copilot.previousPanelSolution';
export const CMDNavigateNextPanelSolutionClient = 'acp.copilot.nextPanelSolution';

export const CMDToggleStatusMenuClient = 'acp.copilot.toggleStatusMenu';
export const CMDToggleStatusMenuChat = 'acp.copilot.chat.toggleStatusMenu';

// Needs to be supported in both extensions when they are loaded/active. Requires a different ID.
export const CMDSendCompletionsFeedbackChat = 'acp.copilot.chat.sendCompletionFeedback';

export const CMDEnableCompletionsChat = 'acp.copilot.chat.completions.enable';
export const CMDDisableCompletionsChat = 'acp.copilot.chat.completions.disable';
export const CMDToggleCompletionsChat = 'acp.copilot.chat.completions.toggle';
export const CMDEnableCompletionsClient = 'acp.copilot.completions.enable';
export const CMDDisableCompletionsClient = 'acp.copilot.completions.disable';
export const CMDToggleCompletionsClient = 'acp.copilot.completions.toggle';

export const CMDOpenLogsClient = 'acp.copilot.openLogs';
export const CMDOpenDocumentationClient = 'acp.copilot.openDocs';

// Existing chat command reused for diagnostics
export const CMDCollectDiagnosticsChat = 'acp.copilot.debug.collectDiagnostics';

// Context variable that enable/disable panel-specific commands
export const CopilotPanelVisible = 'acp.copilot.panelVisible';
export const ComparisonPanelVisible = 'acp.copilot.comparisonPanelVisible';
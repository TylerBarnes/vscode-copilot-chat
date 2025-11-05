/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode } from 'vscode';
import { IDiffService } from '../../../platform/diff/common/diffService';
import { DiffServiceImpl } from '../../../platform/diff/node/diffServiceImpl';
import { INativeEnvService } from '../../../platform/env/common/envService';
import { NativeEnvServiceImpl } from '../../../platform/env/vscode-node/nativeEnvServiceImpl';
import { ISearchService } from '../../../platform/search/common/searchService';
import { StubSearchService } from '../../../platform/acp/stub-search-service';
import { ISettingsEditorSearchService, NoopSettingsEditorSearchService } from '../../../platform/settingsEditor/common/settingsEditorSearchService';
import { IExperimentationService, NullExperimentationService } from '../../../platform/acp/stub-experimentation-service';
import { ICopilotTokenManager, StubTokenManager } from '../../../platform/acp/stub-token-manager';
import { IInstantiationServiceBuilder } from '../../../util/common/services';
import { SyncDescriptor } from '../../../util/vs/platform/instantiation/common/descriptors';
import { registerServices as registerCommonServices } from '../vscode/services';

// ###########################################################################################
// ###                                                                                     ###
// ###               Node services that run ONLY in node.js extension host.                ###
// ###                                                                                     ###
// ###  !!! Prefer to list services in ../vscode/services.ts to support them anywhere !!!  ###
// ###                                                                                     ###
// ###########################################################################################

export function registerServices(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext): void {
    const isTestMode = extensionContext.extensionMode === ExtensionMode.Test;

    // Register IExperimentationService first to avoid dependency injection issues
    setupMSFTExperimentationService(builder, extensionContext);

    registerCommonServices(builder, extensionContext);

    // Removed IAutomodeService (proprietary)
    // Removed IConversationStore (proprietary - conversation deleted)
    builder.define(IDiffService, new DiffServiceImpl());
    // Removed ITokenizerProvider (proprietary - tokenizer deleted)
    // Removed IToolsService (proprietary - tools deleted)
    // Removed IRequestLogger (proprietary - prompt deleted)
	builder.define(INativeEnvService, new SyncDescriptor(NativeEnvServiceImpl));

	// Removed IFetcherService, IDomainService, ICAPIClientService, IImageService (proprietary)

	builder.define(ITelemetryUserConfig, new SyncDescriptor(TelemetryUserConfigImpl, [undefined, undefined]));
	const internalAIKey = extensionContext.extension.packageJSON.internalAIKey ?? '';
	const internalLargeEventAIKey = extensionContext.extension.packageJSON.internalLargeStorageAriaKey ?? '';
	const ariaKey = extensionContext.extension.packageJSON.ariaKey ?? '';
// Use stub token manager for ACP - we don't need GitHub Copilot authentication
    // This avoids the devDeviceId proposed API dependency
    builder.define(ICopilotTokenManager, new SyncDescriptor(StubTokenManager));

    // Removed IAuthenticationService (proprietary - authentication deleted)

    // Removed ITestGenInfoStorage, IIntentService (proprietary - intents deleted)
    // Removed IParserService (proprietary - parser deleted)
// Removed IIgnoreService, INaiveChunkingService (proprietary)
// Removed IWorkspaceFileIndex, IChunkingEndpointClient (proprietary)
	// Removed ICommandService (proprietary - commands deleted)
    // Removed IDocsSearchClient (remoteSearch deleted)
// Search - Use stub service to avoid findFiles2 API proposal dependency
        builder.define(ISearchService, new SyncDescriptor(StubSearchService));
    // Token Manager - Use stub service to avoid devDeviceId API proposal dependency
        builder.define(ICopilotTokenManager, new SyncDescriptor(StubTokenManager));
    // Removed: ITestDepsResolver, ISetupTestsDetector, IWorkspaceMutationManager (proprietary testing services)
    // Removed IScopeSelector (proprietary - scopeSelection deleted)
	builder.define(IGitDiffService, new SyncDescriptor(GitDiffService));
	builder.define(IGitCommitMessageService, new SyncDescriptor(GitCommitMessageServiceImpl));
// Removed IGithubRepositoryService (proprietary)
    // builder.define(IDevContainerConfigurationService, new SyncDescriptor(DevContainerConfigurationServiceImpl)); // Removed - proprietary
    // Removed IChatAgentService (proprietary)
    // Removed ILinkifyService registration (proprietary - linkify deleted)
    // Removed IChatMLFetcher (proprietary)
    // Removed IFeedbackReporter (proprietary - prompt deleted)
    // Removed IApiEmbeddingsIndex (proprietary)
    // Removed IGithubCodeSearchService, IAdoCodeSearchService, IWorkspaceChunkSearchService (proprietary)
    builder.define(ISettingsEditorSearchService, new SyncDescriptor(NoopSettingsEditorSearchService));
    // Removed INewWorkspacePreviewContentManager (proprietary)
    // Removed IPromptVariablesService (proprietary - prompts deleted)
    // Removed IPromptWorkspaceLabels (proprietary - context deleted)
    // Removed IUserFeedbackService (proprietary - prompt deleted)
    // Removed IDebugCommandToConfigConverter (proprietary - onboardDebug deleted)
    // Removed IDebuggableCommandIdentifier (proprietary - onboardDebug deleted)
    // Removed ILanguageToolsProvider, ICodeMapperService (proprietary)
	// Removed ICompletionsFetchService (proprietary - nesFetch deleted)
	// Removed IFixCookbookService (proprietary - prompts deleted)
	// Removed ILanguageContextService (proprietary - typescriptContext deleted)
	// Removed ILanguageContextProviderService (proprietary - typescriptContext deleted)
	// Removed IWorkspaceListenerService (proprietary - prompts deleted)
// Removed ICodeSearchAuthenticationService, IGithubAvailableEmbeddingTypesService, IRerankerService (proprietary)
    // Removed ITodoListContextProvider (proprietary - context deleted)
}

function setupMSFTExperimentationService(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext) {
    // Always use NullExperimentationService for ACP to avoid devDeviceId dependency
    builder.define(IExperimentationService, new NullExperimentationService());
}

function setupTelemetry(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext, internalAIKey: string, internalLargeEventAIKey: string, externalAIKey: string) {

	if (ExtensionMode.Production === extensionContext.extensionMode && !isScenarioAutomation) {
		builder.define(ITelemetryService, new SyncDescriptor(TelemetryService, [
			extensionContext.extension.packageJSON.name,
			internalAIKey,
			internalLargeEventAIKey,
			externalAIKey,
			APP_INSIGHTS_KEY_STANDARD,
			APP_INSIGHTS_KEY_ENHANCED,
		]));
	} else {
		// If we're developing or testing we don't want telemetry to be sent, so we turn it off
		builder.define(ITelemetryService, new NullTelemetryService());
	}

	setupMSFTExperimentationService(builder, extensionContext);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode, env } from 'vscode';
// Removed proprietary authentication services
import { StubTokenManager } from '../../../platform/acp/stub-token-manager';
// Removed proprietary chat services
// Removed proprietary chunking services
import { IDevContainerConfigurationService } from '../../../platform/devcontainer/common/devContainerConfigurationService';
import { IDiffService } from '../../../platform/diff/common/diffService';
import { DiffServiceImpl } from '../../../platform/diff/node/diffServiceImpl';
// Removed proprietary endpoint services
import { INativeEnvService, isScenarioAutomation } from '../../../platform/env/common/envService';
import { NativeEnvServiceImpl } from '../../../platform/env/vscode-node/nativeEnvServiceImpl';
import { IGitCommitMessageService } from '../../../platform/git/common/gitCommitMessageService';
import { IGitDiffService } from '../../../platform/git/common/gitDiffService';
// Removed proprietary github, ignore, and image services
// Removed ILanguageContextProviderService (proprietary - typescriptContext deleted)
// Removed ILanguageContextService (proprietary - typescriptContext deleted)
// Removed ICompletionsFetchService (proprietary - nesFetch deleted)
// Removed CompletionsFetchService (proprietary - nesFetch deleted)
// Removed proprietary networking services
// Removed IParserService (proprietary - parser deleted)
// Removed proprietary remote code search services
// Removed proprietary code search authentication services
// Removed IDocsSearchClient (remoteSearch deleted)
import { IRequestLogger } from '../../../platform/requestLogger/node/requestLogger';
// Removed IScopeSelector, ScopeSelectorImpl (proprietary - scopeSelection deleted)
import { ISearchService } from '../../../platform/search/common/searchService';
// Removed SearchServiceImpl (using StubSearchService instead)
import { StubSearchService } from '../../../platform/acp/stub-search-service';
import { ISettingsEditorSearchService, NoopSettingsEditorSearchService } from '../../../platform/settingsEditor/common/settingsEditorSearchService';
import { IExperimentationService, NullExperimentationService } from '../../../platform/acp/stub-experimentation-service';
// Removed proprietary telemetry services (ITelemetryService, NullTelemetryService, TelemetryService)
// Removed proprietary testing services (IWorkspaceMutationManager, ISetupTestsDetector, ITestDepsResolver)
// Removed proprietary tokenizer services
// Removed proprietary workspace chunk search and embeddings services
import { IInstantiationServiceBuilder } from '../../../util/common/services';
import { SyncDescriptor } from '../../../util/vs/platform/instantiation/common/descriptors';
// Removed proprietary command service (depends on deleted intents)
// Removed ApiEmbeddingsIndex, IApiEmbeddingsIndex (proprietary)
// Removed IPromptWorkspaceLabels (depends on deleted ignore/telemetry services)
// Removed ChatAgentService (proprietary - conversation deleted)
// Removed ConversationStore (proprietary - conversation deleted)
// Removed IIntentService, IntentService, INewWorkspacePreviewContentManager, NewWorkspacePreviewContentManagerImpl, ITestGenInfoStorage, TestGenInfoStorage (proprietary)
// Removed LanguageContextProviderService (proprietary - typescriptContext deleted)
// Removed ILinkifyService, LinkifyService (proprietary - linkify deleted)
import { collectFetcherTelemetry } from '../../log/vscode-node/loggingActions';
// Removed onboardDebug services (proprietary - deleted)
// Removed ILanguageToolsProvider, LanguageToolsProvider (proprietary)
// Removed ChatMLFetcherImpl (proprietary)
// Removed prompt services (proprietary - deleted)
// Removed prompts services (proprietary - deleted)
// Removed WorkspaceMutationManager (proprietary - testing deleted)
// Removed IToolsService, ToolsService (proprietary - tools deleted)
// Removed typescriptContext services (proprietary - deleted)
// Removed workspaceRecorder services (proprietary - deleted)
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
    // Removed: ITestDepsResolver, ISetupTestsDetector, IWorkspaceMutationManager (proprietary testing services)
    // Removed IScopeSelector (proprietary - scopeSelection deleted)
	builder.define(IGitDiffService, new SyncDescriptor(GitDiffService));
	builder.define(IGitCommitMessageService, new SyncDescriptor(GitCommitMessageServiceImpl));
// Removed IGithubRepositoryService (proprietary)
    builder.define(IDevContainerConfigurationService, new SyncDescriptor(DevContainerConfigurationServiceImpl));
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

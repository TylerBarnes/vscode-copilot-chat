/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode } from 'vscode';
// Authentication services removed - no longer needed for ACP
// Removed chat services (chat deleted)
// Removed command services (commands deleted)
import { IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ConfigurationServiceImpl } from '../../../platform/configuration/vscode/configurationServiceImpl';
// Removed CustomInstructionsService, ICustomInstructionsService (customInstructions - proprietary)
// import { IDebugOutputService } from '../../../platform/debug/common/debugOutputService'; // Removed - proprietary
// import { DebugOutputServiceImpl } from '../../../platform/debug/vscode/debugOutputServiceImpl'; // Removed - proprietary
import { IDialogService } from '../../../platform/dialog/common/dialogService';
import { DialogServiceImpl } from '../../../platform/dialog/vscode/dialogServiceImpl';
// Removed EditSurvivalTrackerService (editSurvivalTracking deleted)
// Removed IEmbeddingsComputer, RemoteEmbeddingsComputer, ICombinedEmbeddingIndex, VSCodeCombinedIndexImpl (proprietary)
import { IEnvService, isScenarioAutomation } from '../../../platform/env/common/envService';
import { EnvServiceImpl } from '../../../platform/env/vscode/envServiceImpl';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { IExtensionsService } from '../../../platform/extensions/common/extensionsService';
import { VSCodeExtensionsService } from '../../../platform/extensions/vscode/extensionsService';
import { IFileSystemService } from '../../../platform/filesystem/common/fileSystemService';
import { VSCodeFileSystemService } from '../../../platform/filesystem/vscode/fileSystemServiceImpl';
import { IGitExtensionService } from '../../../platform/git/common/gitExtensionService';
import { IGitService } from '../../../platform/git/common/gitService';
import { GitExtensionServiceImpl } from '../../../platform/git/vscode/gitExtensionServiceImpl';
import { GitServiceImpl } from '../../../platform/git/vscode/gitServiceImpl';
// GitHub service removed - no longer needed
// Heatmap service removed - no longer needed
// Removed IInteractiveSessionService, InteractiveSessionServiceImpl (interactive - proprietary)
import { ILanguageDiagnosticsService } from '../../../platform/languages/common/languageDiagnosticsService';
import { ILanguageFeaturesService } from '../../../platform/languages/common/languageFeaturesService';
import { LanguageDiagnosticsServiceImpl } from '../../../platform/languages/vscode/languageDiagnosticsServiceImpl';
import { LanguageFeaturesServiceImpl } from '../../../platform/languages/vscode/languageFeaturesServicesImpl';
import { ILogService, LogServiceImpl } from '../../../platform/log/common/logService';
import { NewOutputChannelLogTarget } from '../../../platform/log/vscode/outputChannelLogTarget';
// Removed EditLogService and MultiFileEditInternalTelemetryService (multiFileEdit deleted)
// Networking and notebook services removed - no longer needed
import { INotificationService, NullNotificationService } from '../../../platform/notification/common/notificationService';
import { NotificationService } from '../../../platform/notification/vscode/notificationServiceImpl';
import { IUrlOpener, NullUrlOpener } from '../../../platform/open/common/opener';
import { RealUrlOpener } from '../../../platform/open/vscode/opener';
// Removed ProjectTemplatesIndex (projectTemplatesIndex deleted)
// Removed IPromptPathRepresentationService, PromptPathRepresentationService (prompts - proprietary)
// Removed ReleaseNotesService (releaseNotes deleted)
// Removed IRemoteRepositoriesService, RemoteRepositoriesService (remoteRepositories - proprietary)
// Removed IReviewService, ReviewServiceImpl (review - proprietary)
// Removed ISimulationTestContext, NulSimulationTestContext (simulationTestContext - proprietary)
// Removed SnippyService (snippy deleted)
// Removed SurveyService (survey deleted)
import { ITabsAndEditorsService } from '../../../platform/tabs/common/tabsAndEditorsService';
import { TabsAndEditorsServiceImpl } from '../../../platform/tabs/vscode/tabsAndEditorsServiceImpl';
import { ITasksService } from '../../../platform/tasks/common/tasksService';
import { TasksService } from '../../../platform/tasks/vscode/tasksService';
import { ITerminalService } from '../../../platform/terminal/common/terminalService';
import { TerminalServiceImpl } from '../../../platform/terminal/vscode/terminalServiceImpl';
// Removed: ITestProvider, TestProvider (proprietary testing services)
import { IWorkbenchService } from '../../../platform/workbench/common/workbenchService';
import { WorkbenchServiceImpl } from '../../../platform/workbench/vscode/workbenchServiceImpt';
import { IWorkspaceService } from '../../../platform/workspace/common/workspaceService';
import { ExtensionTextDocumentManager } from '../../../platform/workspace/vscode/workspaceServiceImpl';
import { IInstantiationServiceBuilder } from '../../../util/common/services';
import { SyncDescriptor } from '../../../util/vs/platform/instantiation/common/descriptors';
// Removed merge conflict services (git deleted)
// Removed LaunchConfigService (onboardDebug deleted)
// Tools system removed - no longer needed
// Removed PromptsServiceImpl, IPromptsService (promptFiles - proprietary)

// ##########################################################################
// ###                                                                    ###
// ###      Services that run in both web and node.js extension host.     ###
// ###                                                                    ###
// ### !!! Prefer to list services in HERE to support them anywhere !!!   ###
// ###                                                                    ###
// ##########################################################################

export function registerServices(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext): void {
	const isTestMode = extensionContext.extensionMode === ExtensionMode.Test;

    // Removed IInteractionService (chat deleted)
    // CopilotTokenStore removed - no longer needed for ACP
    // builder.define(IDebugOutputService, new DebugOutputServiceImpl()); // Removed - proprietary
	builder.define(IDialogService, new DialogServiceImpl());
    builder.define(IEnvService, new EnvServiceImpl());
    builder.define(IFileSystemService, new VSCodeFileSystemService());
    // Notebook and networking services removed - no longer needed
    // Removed IRemoteRepositoriesService (proprietary - remoteRepositories deleted)
	builder.define(ITabsAndEditorsService, new TabsAndEditorsServiceImpl());
	builder.define(ITerminalService, new SyncDescriptor(TerminalServiceImpl));
	// Removed: ITestProvider (proprietary testing service)
	builder.define(IUrlOpener, isTestMode && !isScenarioAutomation ? new NullUrlOpener() : new RealUrlOpener());
    builder.define(INotificationService, isTestMode && !isScenarioAutomation ? new NullNotificationService() : new NotificationService());
    builder.define(IVSCodeExtensionContext, <any>/*force _serviceBrand*/extensionContext);
    builder.define(IWorkbenchService, new WorkbenchServiceImpl());
    // Removed IConversationOptions (proprietary chat service)
    // Removed IChatSessionService (chat deleted)
    builder.define(IConfigurationService, new SyncDescriptor(ConfigurationServiceImpl));
	builder.define(ILogService, new SyncDescriptor(LogServiceImpl, [[new NewOutputChannelLogTarget(extensionContext)]]));
	// Removed IChatQuotaService (chat deleted)
	builder.define(ITasksService, new SyncDescriptor(TasksService));
	builder.define(IGitExtensionService, new SyncDescriptor(GitExtensionServiceImpl));
	builder.define(IGitService, new SyncDescriptor(GitServiceImpl));
    // OctoKitService and ReviewService removed - no longer needed
	builder.define(ILanguageDiagnosticsService, new SyncDescriptor(LanguageDiagnosticsServiceImpl));
	builder.define(ILanguageFeaturesService, new SyncDescriptor(LanguageFeaturesServiceImpl));
	// Removed IRunCommandExecutionService (commands deleted)
    // Removed ISimulationTestContext (simulationTestContext - proprietary)
    builder.define(IWorkspaceService, new SyncDescriptor(ExtensionTextDocumentManager));
    builder.define(IExtensionsService, new SyncDescriptor(VSCodeExtensionsService));
    // Removed ICombinedEmbeddingIndex (proprietary)
    // Removed IProjectTemplatesIndex (projectTemplatesIndex deleted)
    // Removed IBlockedExtensionService (proprietary)
    // Removed IEditLogService and IMultiFileEditInternalTelemetryService (multiFileEdit deleted)
    // Removed ICustomInstructionsService (customInstructions - proprietary)
    // Removed ILaunchConfigService (onboardDebug deleted)
    // Heatmap, tools, and notebook services removed - no longer needed
    // Removed ISurveyService (survey deleted)
    // Removed IEditSurvivalTrackerService (editSurvivalTracking deleted)
    // Removed IPromptPathRepresentationService (prompts - proprietary)
    // Removed IPromptsService (promptFiles - proprietary)
    // Removed IReleaseNotesService (releaseNotes deleted)
    // Removed ISnippyService (snippy deleted)
    // Removed IInteractiveSessionService (interactive - proprietary)
    // AuthenticationChatUpgradeService removed - no longer needed for ACP
    // Removed IMergeConflictService (git deleted)
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionContributionFactory } from '../../common/contributions';

// ###############################################################################
// ###                                                                         ###
// ###      Contributions that run in both web and node.js extension host.     ###
// ###                                                                         ###
// ###  !!! Prefer to list contributions in HERE to support them anywhere !!!  ###
// ###                                                                         ###
// ###############################################################################
// 
// ACP Transformation: All proprietary GitHub Copilot contributions have been
// removed. Only ACP-compatible contributions remain.

const vscodeContributions: IExtensionContributionFactory[] = [
    // All telemetry and proprietary contributions removed for ACP compatibility
];

export default vscodeContributions;

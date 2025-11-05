/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServiceIdentifier } from '../../util/common/services';

/**
 * Minimal stub for IExperimentationService to satisfy type dependencies.
 * This is a no-op implementation since ACP does not use Microsoft's experimentation system.
 */
export const IExperimentationService = createServiceIdentifier<IExperimentationService>('IExperimentationService');

export interface IExperimentationService {
	readonly _serviceBrand: undefined;
	getTreatmentVariable<T extends string | number | boolean>(
		configId: string,
		name: string,
		defaultValue?: T
	): Promise<T | undefined>;
	getTreatmentVariableAsync<T extends string | number | boolean>(
		configId: string,
		name: string,
		checkCache?: boolean
	): Promise<T | undefined>;
	isCachedFlightEnabled(flight: string): Promise<boolean | undefined>;
}

/**
 * Null implementation of IExperimentationService.
 * Always returns default values and indicates no experiments are enabled.
 */
export class NullExperimentationService implements IExperimentationService {
	declare readonly _serviceBrand: undefined;

	async getTreatmentVariable<T extends string | number | boolean>(
		_configId: string,
		_name: string,
		defaultValue?: T
	): Promise<T | undefined> {
		return defaultValue;
	}

	async getTreatmentVariableAsync<T extends string | number | boolean>(
		_configId: string,
		_name: string,
		_checkCache?: boolean
	): Promise<T | undefined> {
		return undefined;
	}

	async isCachedFlightEnabled(_flight: string): Promise<boolean | undefined> {
		return false;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ThinkingDataInMessage {
    // Chain-of-thought fields (Azure OpenAI format)
    cot_id?: string;
    cot_summary?: string;

    // Reasoning fields (alternative format)
    reasoning_opaque?: string;
    reasoning_text?: string;
}

export interface RawThinkingDelta {
    // Chain-of-thought fields (Azure OpenAI format)
    cot_id?: string;
    cot_summary?: string;

    // Reasoning fields (alternative format)
    reasoning_opaque?: string;
    reasoning_text?: string;

    // Thinking fields (Anthropic format)
    thinking?: string;
    signature?: string;
}

export type ThinkingDelta = {
	text?: string | string[];
	id: string;
	metadata?: { readonly [key: string]: any };
} | {
	text?: string | string[];
	id?: string;
	metadata: { readonly [key: string]: any };
} |
{
	text: string | string[];
	id?: string;
	metadata?: { readonly [key: string]: any };
};

export type EncryptedThinkingDelta = {
	id: string;
	text?: string;
	encrypted: string;
}

export function isEncryptedThinkingDelta(delta: ThinkingDelta | EncryptedThinkingDelta): delta is EncryptedThinkingDelta {
	return (delta as EncryptedThinkingDelta).encrypted !== undefined;
}

export interface ThinkingData {
	id: string;
	text: string | string[];
	metadata?: { [key: string]: any };
	tokens?: number;
	encrypted?: string;
}

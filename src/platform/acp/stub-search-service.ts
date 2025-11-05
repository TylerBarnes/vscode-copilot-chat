/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ISearchService } from '../search/common/searchService';

/**
 * Stub implementation of ISearchService for ACP.
 * ACP agents handle file operations via the ACP protocol's file_system capabilities,
 * so this stub returns empty results or uses basic VS Code APIs to satisfy the interface.
 */
export class StubSearchService implements ISearchService {
    readonly _serviceBrand: undefined;

    async findFilesWithDefaultExcludes(
        include: vscode.GlobPattern,
        maxResults: 1,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri | undefined>;
    async findFilesWithDefaultExcludes(
        include: vscode.GlobPattern,
        maxResults: number | undefined,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri[]>;
    async findFilesWithDefaultExcludes(
        include: vscode.GlobPattern,
        maxResults: number | undefined,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri[] | vscode.Uri | undefined> {
        // Use basic findFiles API (not findFiles2)
        try {
            const results = await vscode.workspace.findFiles(include, undefined, maxResults, token);
            if (maxResults === 1) {
                return results[0];
            }
            return results;
        } catch {
            return maxResults === 1 ? undefined : [];
        }
    }

    async findTextInFiles(
        query: vscode.TextSearchQuery,
        options: vscode.FindTextInFilesOptions,
        progress: vscode.Progress<vscode.TextSearchResult>,
        token: vscode.CancellationToken
    ): Promise<vscode.TextSearchComplete> {
        // Use basic findTextInFiles API
        try {
            return await vscode.workspace.findTextInFiles(query, options, result => progress.report(result), token);
        } catch {
            return { limitHit: false };
        }
    }

    findTextInFiles2(
        query: vscode.TextSearchQuery2,
        options?: vscode.FindTextInFilesOptions2,
        token?: vscode.CancellationToken
    ): vscode.FindTextInFilesResponse {
        // Return empty response - ACP doesn't need this
        return {
            results: [],
            complete: Promise.resolve({ resultCount: 0 })
        } as any;
    }

    async findFiles(
        filePattern: vscode.GlobPattern | vscode.GlobPattern[],
        options?: vscode.FindFiles2Options,
        token?: vscode.CancellationToken
    ): Promise<vscode.Uri[]> {
        // Use basic findFiles API (not findFiles2)
        try {
            const pattern = Array.isArray(filePattern) ? filePattern[0] : filePattern;
            if (!pattern) {
                return [];
            }
            const exclude = options?.exclude?.[0];
            const maxResults = options?.maxResults;
            return await vscode.workspace.findFiles(pattern, exclude, maxResults, token);
        } catch {
            return [];
        }
    }

    async findFilesWithExcludes(
        include: vscode.GlobPattern,
        exclude: vscode.GlobPattern,
        maxResults: 1,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri | undefined>;
    async findFilesWithExcludes(
        include: vscode.GlobPattern,
        exclude: vscode.GlobPattern,
        maxResults: number | undefined,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri[] | vscode.Uri | undefined> {
        // Use basic findFiles API
        try {
            const results = await vscode.workspace.findFiles(include, exclude, maxResults, token);
            if (maxResults === 1) {
                return results[0];
            }
            return results;
        } catch {
            return maxResults === 1 ? undefined : [];
        }
    }
}
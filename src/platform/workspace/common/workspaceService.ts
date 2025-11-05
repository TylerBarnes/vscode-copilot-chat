/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Event, FileSystem, TextDocument, TextDocumentChangeEvent, TextEditorSelectionChangeEvent, Uri, WorkspaceEdit, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';
// Removed: findNotebook (proprietary notebook support)
import { createServiceIdentifier } from '../../../util/common/services';
import * as path from '../../../util/vs/base/common/path';
import { extUriBiasedIgnorePathCase, relativePath } from '../../../util/vs/base/common/resources';
import { URI } from '../../../util/vs/base/common/uri';
// Removed: NotebookDocumentSnapshot (proprietary notebook support)
import { TextDocumentSnapshot } from '../../../util/textDocumentSnapshot';
import { DisposableStore, IDisposable } from '../../../util/vs/base/common/lifecycle';
import { Emitter } from '../../../util/vs/base/common/event';

export const IWorkspaceService = createServiceIdentifier<IWorkspaceService>('IWorkspaceService');

export interface IWorkspaceService {
    readonly _serviceBrand: undefined;
    textDocuments: readonly TextDocument[];
    // Removed: notebookDocuments (proprietary notebook support)
    readonly onDidOpenTextDocument: Event<TextDocument>;
    readonly onDidCloseTextDocument: Event<TextDocument>;
    // Removed: onDidOpenNotebookDocument, onDidCloseNotebookDocument, onDidChangeNotebookDocument (proprietary notebook support)
    readonly onDidChangeTextDocument: Event<TextDocumentChangeEvent>;
    readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
    readonly onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>;
    openTextDocument(uri: Uri): Promise<TextDocument>;
    fs: FileSystem;
    showTextDocument(document: TextDocument): Promise<void>;
    openTextDocumentAndSnapshot(uri: Uri): Promise<TextDocumentSnapshot>;
    // Removed: openNotebookDocumentAndSnapshot, openNotebookDocument (proprietary notebook support)
    getWorkspaceFolders(): URI[];
    getWorkspaceFolder(resource: URI): URI | undefined;
    getWorkspaceFolderName(workspaceFolderUri: URI): string;
    showWorkspaceFolderPicker(): Promise<WorkspaceFolder | undefined>;

    asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;
    applyEdit(edit: WorkspaceEdit): Thenable<boolean>;

	/**
	 * Ensures that the workspace has fully loaded before returning. This is useful for
	 * virtual workspaces where we need to ensure that the contents of the workspace
	 * has been downloaded before we can use them.
	 */
	ensureWorkspaceIsFullyLoaded(): Promise<void>;
}

export abstract class AbstractWorkspaceService implements IWorkspaceService {
    declare readonly _serviceBrand: undefined;
    abstract textDocuments: readonly TextDocument[];
    // Removed: notebookDocuments (proprietary notebook support)
    abstract readonly onDidOpenTextDocument: Event<TextDocument>;
    abstract readonly onDidCloseTextDocument: Event<TextDocument>;
    // Removed: onDidOpenNotebookDocument, onDidCloseNotebookDocument, onDidChangeNotebookDocument (proprietary notebook support)
    abstract readonly onDidChangeTextDocument: Event<TextDocumentChangeEvent>;
    abstract readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
    abstract readonly onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>;
    abstract openTextDocument(uri: Uri): Promise<TextDocument>;
    abstract fs: FileSystem;
    abstract showTextDocument(document: TextDocument): Promise<void>;
    // Removed: openNotebookDocument (proprietary notebook support)
    abstract getWorkspaceFolders(): URI[];
    abstract ensureWorkspaceIsFullyLoaded(): Promise<void>;
    abstract showWorkspaceFolderPicker(): Promise<WorkspaceFolder | undefined>;
    abstract getWorkspaceFolderName(workspaceFolderUri: URI): string;
    abstract applyEdit(edit: WorkspaceEdit): Thenable<boolean>;
	asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string {
		// Copied from the implementation in vscode/extHostWorkspace.ts
		let resource: URI | undefined;
		let path: string = '';
		if (typeof pathOrUri === 'string') {
			resource = URI.file(pathOrUri);
			path = pathOrUri;
		} else if (typeof pathOrUri !== 'undefined') {
			resource = pathOrUri;
			path = pathOrUri.fsPath;
		}

		if (!resource) {
			return path;
		}

		const folder = this.getWorkspaceFolder(resource);

		if (!folder) {
			return path;
		}

		if (typeof includeWorkspaceFolder === 'undefined') {
			includeWorkspaceFolder = this.getWorkspaceFolders().length > 1;
		}

		let result = relativePath(folder, resource);
		if (includeWorkspaceFolder) {
			const name = this.getWorkspaceFolderName(folder);
			result = `${name}/${result}`;
		}
		return result!;
	}

    async openTextDocumentAndSnapshot(uri: Uri): Promise<TextDocumentSnapshot> {
        const doc = await this.openTextDocument(uri);

        return TextDocumentSnapshot.create(doc);
    }

    // Removed: openNotebookDocumentAndSnapshot (proprietary notebook support)

	getWorkspaceFolder(resource: URI): URI | undefined {
		return this.getWorkspaceFolders().find(folder => extUriBiasedIgnorePathCase.isEqualOrParent(resource, folder));
	}
}

export function getWorkspaceFileDisplayPath(workspaceService: IWorkspaceService, file: URI): string {
	const workspaceUri = workspaceService.getWorkspaceFolder(file);
	return workspaceUri ? path.posix.relative(workspaceUri.path, file.path) : file.path;
}

export class NullWorkspaceService extends AbstractWorkspaceService implements IDisposable {
	override fs!: FileSystem;
	private readonly disposables = new DisposableStore();

	public readonly didOpenTextDocumentEmitter = this.disposables.add(new Emitter<TextDocument>());
	public readonly didCloseTextDocumentEmitter = this.disposables.add(new Emitter<TextDocument>());
    // Removed: didOpenNotebookDocumentEmitter, didCloseNotebookDocumentEmitter, didChangeNotebookDocumentEmitter (proprietary notebook support)
    public readonly didChangeTextDocumentEmitter = this.disposables.add(new Emitter<TextDocumentChangeEvent>());
    public readonly didChangeWorkspaceFoldersEmitter = this.disposables.add(new Emitter<WorkspaceFoldersChangeEvent>());
    public readonly didChangeTextEditorSelectionEmitter = this.disposables.add(new Emitter<TextEditorSelectionChangeEvent>());

    public override readonly onDidChangeTextDocument = this.didChangeTextDocumentEmitter.event;
    public override readonly onDidCloseTextDocument = this.didCloseTextDocumentEmitter.event;
    // Removed: onDidOpenNotebookDocument, onDidCloseNotebookDocument, onDidChangeNotebookDocument (proprietary notebook support)
    public override readonly onDidOpenTextDocument = this.didOpenTextDocumentEmitter.event;
    public override readonly onDidChangeWorkspaceFolders = this.didChangeWorkspaceFoldersEmitter.event;
    public override readonly onDidChangeTextEditorSelection = this.didChangeTextEditorSelectionEmitter.event;

    private readonly workspaceFolder: URI[];
    private readonly _textDocuments: TextDocument[] = [];
    // Removed: _notebookDocuments (proprietary notebook support)

    constructor(workspaceFolders: URI[] = [], textDocuments: TextDocument[] = []) {
        super();
        this.workspaceFolder = workspaceFolders;
        this._textDocuments = textDocuments;
        // Removed: notebookDocuments parameter (proprietary notebook support)
    }

	get textDocuments(): TextDocument[] {
		return this._textDocuments;
	}

	override showTextDocument(document: TextDocument): Promise<void> {
		return Promise.resolve();
	}

	override async openTextDocument(uri: Uri): Promise<TextDocument> {
		const doc = this.textDocuments.find(d => d.uri.toString() === uri.toString());
		if (doc) {
			return doc;
		}

		throw new Error(`Unknown document: ${uri}`);
	}

    // Removed: openNotebookDocument (proprietary notebook support)
    // Removed: notebookDocuments getter (proprietary notebook support)

	getWorkspaceFolders(): URI[] {
		return this.workspaceFolder;
	}

	override getWorkspaceFolderName(workspaceFolderUri: URI): string {
		return 'default';
	}

	override ensureWorkspaceIsFullyLoaded(): Promise<void> {
		// We aren't using virtual workspaces here, so we can just return
		return Promise.resolve();
	}

	showWorkspaceFolderPicker(): Promise<undefined> {
		return Promise.resolve(undefined);
	}

	override applyEdit(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public dispose() {
		this.disposables.dispose();
	}
}

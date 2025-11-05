/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as watcher from '@parcel/watcher';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import { copyFile, mkdir } from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname);
const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');
const isPreRelease = process.argv.includes('--prerelease');

const baseBuildOptions = {
	bundle: true,
	logLevel: 'info',
	minify: !isDev,
	outdir: './dist',
	sourcemap: isDev ? 'linked' : false,
	sourcesContent: false,
	treeShaking: true
} satisfies esbuild.BuildOptions;

const baseNodeBuildOptions = {
	...baseBuildOptions,
	external: [
		'./package.json',
		'./.vscode-test.mjs',
		'playwright',
		'keytar',
		'@azure/functions-core',
		'applicationinsights-native-metrics',
		'@opentelemetry/instrumentation',
		'@azure/opentelemetry-instrumentation-azure-sdk',
		'zeromq',
		'electron', // this is for simulation workbench,
		'sqlite3',
		'node-pty', // Required by @github/copilot
		'@github/copilot',
		...(isDev ? [] : ['dotenv', 'source-map-support'])
	],
	platform: 'node',
	mainFields: ["module", "main"], // needed for jsonc-parser,
	define: {
		'process.env.APPLICATIONINSIGHTS_CONFIGURATION_CONTENT': '"{}"'
	},
} satisfies esbuild.BuildOptions;

const webviewBuildOptions = {
	...baseBuildOptions,
	platform: 'browser',
	target: 'es2024', // Electron 34 -> Chrome 132 -> ES2024
    entryPoints: [
        // Removed suggestionsPanelWebview (proprietary - completions-core deleted)
    ],
} satisfies esbuild.BuildOptions;

const nodeExtHostTestGlobs = [
	'src/**/vscode/**/*.test.{ts,tsx}',
	'src/**/vscode-node/**/*.test.{ts,tsx}',
	// deprecated
	'src/extension/**/*.test.{ts,tsx}'
];

const testBundlePlugin: esbuild.Plugin = {
	name: 'testBundlePlugin',
	setup(build) {
		build.onResolve({ filter: /[\/\\]test-extension\.ts$/ }, args => {
			if (args.kind !== 'entry-point') {
				return;
			}
			return { path: path.resolve(args.path) };
		});
		build.onLoad({ filter: /[\/\\]test-extension\.ts$/ }, async args => {
			let files = await glob(nodeExtHostTestGlobs, { cwd: REPO_ROOT, posix: true, ignore: ['src/extension/completions-core/**/*'] });
			files = files.map(f => path.posix.relative('src', f));
			if (files.length === 0) {
				throw new Error('No extension tests found');
			}
			return {
				contents: files
					.map(f => `require('./${f}');`)
					.join(''),
				watchDirs: files.map(path.dirname),
				watchFiles: files,
			};
		});
	}
};

const nodeExtHostSanityTestGlobs = [
	'src/**/vscode-node/**/*.sanity-test.{ts,tsx}',
];

const sanityTestBundlePlugin: esbuild.Plugin = {
	name: 'sanityTestBundlePlugin',
	setup(build) {
		build.onResolve({ filter: /[\/\\]sanity-test-extension\.ts$/ }, args => {
			if (args.kind !== 'entry-point') {
				return;
			}
			return { path: path.resolve(args.path) };
		});
		build.onLoad({ filter: /[\/\\]sanity-test-extension\.ts$/ }, async args => {
			let files = await glob(nodeExtHostSanityTestGlobs, { cwd: REPO_ROOT, posix: true, ignore: ['src/extension/completions-core/**/*'] });
			files = files.map(f => path.posix.relative('src', f));
			if (files.length === 0) {
				throw new Error('No extension tests found');
			}
			return {
				contents: files
					.map(f => `require('./${f}');`)
					.join(''),
				watchDirs: files.map(path.dirname),
				watchFiles: files,
			};
		});
	}
};

const importMetaPlugin: esbuild.Plugin = {
	name: 'claudeCodeImportMetaPlugin',
	setup(build) {
		// Handle import.meta.url in @anthropic-ai/claude-code package
		build.onLoad({ filter: /node_modules[\/\\]@anthropic-ai[\/\\]claude-code[\/\\].*\.mjs$/ }, async (args) => {
			const contents = await fs.promises.readFile(args.path, 'utf8');
			return {
				contents: contents.replace(
					/import\.meta\.url/g,
					'require("url").pathToFileURL(__filename).href'
				),
				loader: 'js'
			};
		});
	}
};

const shimVsCodeTypesPlugin: esbuild.Plugin = {
	name: 'shimVsCodeTypesPlugin',
	setup(build) {
		// Create a virtual module that will try to require vscode at runtime
		build.onResolve({ filter: /^vscode$/ }, args => {
			return {
				path: 'vscode-dynamic',
				namespace: 'vscode-fallback'
			};
		});

		build.onLoad({ filter: /^vscode-dynamic$/, namespace: 'vscode-fallback' }, () => {
			return {
				contents: `
					let vscode;
					// See test/simulationExtension/extension.js for where and why this is created.
					if (typeof COPILOT_SIMULATION_VSCODE !== 'undefined') {
						vscode = COPILOT_SIMULATION_VSCODE;
					} else {
						try {
							vscode = eval('require(' + JSON.stringify('vscode') + ')');
						} catch (e) {
							vscode = require('./src/util/common/test/shims/vscodeTypesShim.ts');
						}
					}
					module.exports = vscode;
				`,
				resolveDir: REPO_ROOT
			};
		});
	}
};

const nodeExtHostBuildOptions = {
	...baseNodeBuildOptions,
    entryPoints: [
        { in: './src/extension/extension/vscode-node/extension.ts', out: 'extension' },
        // Removed parserWorker (proprietary - parser deleted)
        // Removed tikTokenizerWorker (proprietary - tokenizer deleted)
        { in: './src/platform/diff/node/diffWorkerMain.ts', out: 'diffWorker' },
        { in: './src/platform/tfidf/node/tfidfWorker.ts', out: 'tfidfWorker' },
        // Removed copilotDebugCommand (proprietary - onboardDebug deleted)
        // Removed copilotCLIShim (proprietary - chatSessions deleted)
        // Removed test-extension and sanity-test-extension (simulation tests deleted)
    ],
    loader: { '.ps1': 'text' },
    plugins: [importMetaPlugin], // Removed testBundlePlugin and sanityTestBundlePlugin (simulation tests deleted)
    external: [
		...baseNodeBuildOptions.external,
		'vscode'
	]
} satisfies esbuild.BuildOptions;

const webExtHostBuildOptions = {
	...baseBuildOptions,
	platform: 'browser',
	entryPoints: [
		{ in: './src/extension/extension/vscode-worker/extension.ts', out: 'web' },
	],
	format: 'cjs', // Necessary to export activate function from bundle for extension
	external: [
		'vscode',
		'http',
	]
} satisfies esbuild.BuildOptions;

// Removed nodeExtHostSimulationTestOptions and nodeSimulationBuildOptions (simulation tests deleted)

const nodeSimulationBuildOptions = {
    ...baseNodeBuildOptions,
    entryPoints: [
        // Removed simulationMain.ts (simulation tests deleted)
    ],
	plugins: [shimVsCodeTypesPlugin], // Removed testBundlePlugin (simulation tests deleted)
	external: [
		...baseNodeBuildOptions.external,
	]
} satisfies esbuild.BuildOptions;

// Removed nodeSimulationWorkbenchUIBuildOptions (simulation tests deleted)

// Removed typeScriptServerPluginPackageJsonInstall (proprietary - typescriptContext deleted)
// Removed typeScriptServerPluginBuildOptions (proprietary - typescriptContext deleted)

async function main() {
	if (!isDev) {
		applyPackageJsonPatch(isPreRelease);
	}

    // Removed typeScriptServerPluginPackageJsonInstall call (proprietary - typescriptContext deleted)

	if (isWatch) {

		const contexts: esbuild.BuildContext[] = [];

		const nodeExtHostContext = await esbuild.context(nodeExtHostBuildOptions);
		contexts.push(nodeExtHostContext);

        const webExtHostContext = await esbuild.context(webExtHostBuildOptions);
        contexts.push(webExtHostContext);

        // Removed simulation build contexts (simulation tests deleted)
        // Removed typeScriptServerPluginContext (proprietary - typescriptContext deleted)

		let debounce: NodeJS.Timeout | undefined;

		const rebuild = async () => {
			if (debounce) {
				clearTimeout(debounce);
			}

			debounce = setTimeout(async () => {
				console.log('[watch] build started');
				for (const ctx of contexts) {
					try {
						await ctx.cancel();
						await ctx.rebuild();
					} catch (error) {
						console.error('[watch]', error);
					}
				}
				console.log('[watch] build finished');
			}, 100);
		};


		watcher.subscribe(REPO_ROOT, (err, events) => {
			for (const event of events) {
				console.log(`File change detected: ${event.path}`);
			}
			rebuild();
		}, {
			ignore: [
				`**/.git/**`,
				`**/.simulation/**`,
				`**/test/outcome/**`,
				`.vscode-test/**`,
				`**/.venv/**`,
				`**/dist/**`,
				`**/node_modules/**`,
				`**/*.txt`,
				`**/baseline.json`,
				`**/baseline.old.json`,
				`**/*.w.json`,
				'**/*.sqlite',
				'**/*.sqlite-journal',
				'test/aml/out/**'
			]
		});
		rebuild();
	} else {
        await Promise.all([
            esbuild.build(nodeExtHostBuildOptions),
            esbuild.build(webExtHostBuildOptions),
            // Removed simulation build options (simulation tests deleted)
            // Removed typeScriptServerPluginBuildOptions (proprietary - typescriptContext deleted)
            esbuild.build(webviewBuildOptions),
        ]);
	}
}

function applyPackageJsonPatch(isPreRelease: boolean) {
	const packagejsonPath = path.join(__dirname, './package.json');
	const json = JSON.parse(fs.readFileSync(packagejsonPath).toString());

	const newProps: any = {
		buildType: 'prod',
		isPreRelease,
	};

	const patchedPackageJson = Object.assign(json, newProps);

	// Remove fields which might reveal our development process
	delete patchedPackageJson['scripts'];
	delete patchedPackageJson['devDependencies'];
	delete patchedPackageJson['dependencies'];

	fs.writeFileSync(packagejsonPath, JSON.stringify(patchedPackageJson));
}

main();

import fs from 'node:fs'
import path from 'node:path'
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin'
import type { BuildOptions } from 'esbuild'
import * as esbuild from 'esbuild'
import { companionEsbuildBaseOptions, companionThreadEntryPoints } from './companion-esbuild.mts'
import { bundleInputsFromMetafile, recordBundleInputs } from './licenses/inputs.mts'

const devMode = process.env.ESBUILD_IN_DEV_MODE === '1'
console.log(`Running esbuild in ${devMode ? 'development' : 'production'} mode.`)

const companionDir = path.resolve(import.meta.dirname, '../companion')
const configToolDir = path.resolve(import.meta.dirname, '../config-tool')
const distPath = path.resolve(import.meta.dirname, '../dist')
const buildFile = fs.readFileSync(path.resolve(import.meta.dirname, '../BUILD'), 'utf8').trim()
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const sharedOptions: BuildOptions = {
	...companionEsbuildBaseOptions({ packaged: true, minify: !devMode }),
	absWorkingDir: companionDir,
	outdir: distPath,
	// Needed by the license inventory, which has to know which dependencies ended up in the shipped bundles
	metafile: true,
}

/**
 * esbuild only reports what a build pulled in once it has run, so each build records its own inputs for
 * tools/build_licenses.mts to assemble at the end of the distribution build.
 */
async function buildAndRecord(name: string, options: BuildOptions): Promise<void> {
	const result = await esbuild.build(options)
	if (!result.metafile) throw new Error(`esbuild produced no metafile for ${name}`)
	await recordBundleInputs(name, bundleInputsFromMetafile(result.metafile, options.absWorkingDir ?? process.cwd()))
}

const threadEntryPointsFor = (target: 'node22' | 'node26') =>
	companionThreadEntryPoints.filter((e) => e.target === target).map(({ in: input, out }) => ({ in: input, out }))

// Sentry source-map uploads: each build invocation uploads its own output files to the
// same release. Builds run sequentially so there is no race on release creation/finalization.
const sentryPlugins: BuildOptions['plugins'] = sentryAuthToken
	? [
			sentryEsbuildPlugin({
				authToken: sentryAuthToken,
				org: 'bitfocus',
				project: 'companion',
				release: {
					name: `companion@${buildFile}`,
				},
				errorHandler: (err) => {
					console.warn('Sentry error', err)
				},
			}),
		]
	: []

// Node.js 26: main application and internal worker threads
await buildAndRecord('companion-node26', {
	...sharedOptions,
	plugins: sentryPlugins,
	target: 'node26',
	entryPoints: [{ in: 'lib/main.ts', out: 'main' }, ...threadEntryPointsFor('node26')],
})

// Node.js 26: standalone headless config tool (companion-pi launch tooling).
// This is a linux-only headless tool, so only bundle it for linux builds
const targetBuildPlatform = process.env.COMPANION_BUILD_PLATFORM
if (!targetBuildPlatform || targetBuildPlatform === 'linux') {
	await buildAndRecord('config-tool', {
		...sharedOptions,
		plugins: [],
		absWorkingDir: configToolDir,
		target: 'node26',
		entryPoints: [{ in: 'lib/main.ts', out: 'config-tool' }],
	})
}

// Node.js 22: module host threads (must match user-module targets)
await buildAndRecord('companion-node22', {
	...sharedOptions,
	plugins: sentryPlugins,
	target: 'node22',
	entryPoints: threadEntryPointsFor('node22'),
})

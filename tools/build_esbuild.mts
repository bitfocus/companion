import fs from 'node:fs'
import path from 'node:path'
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin'
import type { BuildOptions } from 'esbuild'
import * as esbuild from 'esbuild'
import { companionNativeExternals } from './companion-externals.mts'

const devMode = process.env.ESBUILD_IN_DEV_MODE === '1'
console.log(`Running esbuild in ${devMode ? 'development' : 'production'} mode.`)

const companionDir = path.resolve(import.meta.dirname, '../companion')
const distPath = path.resolve(import.meta.dirname, '../dist')
const buildFile = fs.readFileSync(path.resolve(import.meta.dirname, '../BUILD'), 'utf8').trim()
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const sharedOptions: BuildOptions = {
	platform: 'node',
	format: 'esm',
	bundle: true,
	absWorkingDir: companionDir,
	outdir: distPath,
	sourcemap: 'linked',
	external: companionNativeExternals,
	define: {
		'process.env.COMPANION_BUNDLED': '"1"',
		'process.env.WS_NO_UTF_8_VALIDATE': '"1"',
	},
	minify: !devMode,
	// CJS packages (e.g. workerpool) use require() inside try/catch blocks that esbuild
	// cannot statically trace. Injecting createRequire makes the synthetic require shim
	// delegate to the real Node.js require instead of throwing.
	banner: {
		js: [
			`import { createRequire as __esbuild_createRequire } from 'module';`,
			`import { fileURLToPath as __esbuild_fileURLToPath } from 'url';`,
			`import { dirname as __esbuild_dirname } from 'path';`,
			`const require = __esbuild_createRequire(import.meta.url);`,
			`const __filename = __esbuild_fileURLToPath(import.meta.url);`,
			`const __dirname = __esbuild_dirname(__filename);`,
		].join('\n'),
	},
	// Sentry source-map uploads: each build invocation uploads its own output files to the
	// same release. Builds run sequentially so there is no race on release creation/finalization.
	plugins: sentryAuthToken
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
		: [],
}

// Node.js 26: main application and internal worker threads
await esbuild.build({
	...sharedOptions,
	target: 'node26',
	entryPoints: [
		{ in: 'lib/main.ts', out: 'main' },
		{ in: 'lib/Graphics/Thread.ts', out: 'RenderThread' },
		{ in: 'lib/ImportExport/Thread.ts', out: 'ImportExportThread' },
	],
})

// Node.js 22: module host threads (must match user-module targets)
await esbuild.build({
	...sharedOptions,
	target: 'node22',
	entryPoints: [
		{ in: 'lib/Instance/Surface/Thread/Entrypoint.ts', out: 'SurfaceThread' },
		{ in: 'lib/Instance/Connection/Thread/Entrypoint.ts', out: 'ConnectionThread' },
	],
})

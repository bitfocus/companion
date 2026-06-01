import path from 'node:path'
import type { BuildOptions, BuildResult } from 'esbuild'
import * as esbuild from 'esbuild'

const devMode = process.env.ESBUILD_IN_DEV_MODE === '1'
console.log(`Running esbuild in ${devMode ? 'development' : 'production'} mode.`)

const distPath = path.resolve(import.meta.dirname, '../dist')

// Pass entry names on the command line to build only specific bundles, e.g.:
//   tsx esbuild.config.mts RenderThread
//   tsx esbuild.config.mts RenderThread ImportExportThread
// Omit arguments to build all entries.
const selectedEntries = new Set(process.argv.slice(2))
const buildAll = selectedEntries.size === 0

function want(name: string): boolean {
	return buildAll || selectedEntries.has(name)
}

const sharedOptions: BuildOptions = {
	platform: 'node',
	format: 'esm',
	bundle: true,
	absWorkingDir: import.meta.dirname,
	outdir: distPath,
	sourcemap: 'linked',
	external: ['usb', '@napi-rs/canvas'],
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
}

// TODO Phase 6: add @sentry/esbuild-plugin when SENTRY_AUTH_TOKEN is set

// Bundles targeting Node.js 26 (main application and internal worker threads)
const node26Entries: Array<{ in: string; out: string }> = [
	// Phase 5: uncomment once threads are verified
	// { in: 'lib/main.ts', out: 'main' },
	{ in: 'lib/Graphics/Thread.ts', out: 'RenderThread' },
	{ in: 'lib/ImportExport/Thread.ts', out: 'ImportExportThread' },
].filter((e) => want(e.out))

// Bundles targeting Node.js 22 (module host threads — must match user-module targets)
const node22Entries: Array<{ in: string; out: string }> = [
	{ in: 'lib/Instance/Surface/Thread/Entrypoint.ts', out: 'SurfaceThread' },
	{ in: 'lib/Instance/Connection/Thread/Entrypoint.ts', out: 'ConnectionThread' },
].filter((e) => want(e.out))

const builds: Array<Promise<BuildResult>> = []

if (node26Entries.length > 0) {
	builds.push(esbuild.build({ ...sharedOptions, target: 'node26', entryPoints: node26Entries }))
}
if (node22Entries.length > 0) {
	builds.push(esbuild.build({ ...sharedOptions, target: 'node22', entryPoints: node22Entries }))
}

await Promise.all(builds)

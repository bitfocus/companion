import type { BuildOptions } from 'esbuild'
import { companionNativeExternals } from './companion-externals.mts'

/**
 * Shared esbuild configuration for Companion's Node bundles, used by BOTH the production build
 * (tools/build_esbuild.mts) and the dev thread bundler (tools/build_dev_threads.mts) so the two
 * cannot drift apart.
 */

// CJS packages (e.g. workerpool) use require() inside try/catch blocks that esbuild cannot
// statically trace. Injecting createRequire makes the synthetic require shim delegate to the real
// Node.js require instead of throwing.
const nodeCompatBanner = [
	`import { createRequire as __esbuild_createRequire } from 'module';`,
	`import { fileURLToPath as __esbuild_fileURLToPath } from 'url';`,
	`import { dirname as __esbuild_dirname } from 'path';`,
	`const require = __esbuild_createRequire(import.meta.url);`,
	`const __filename = __esbuild_fileURLToPath(import.meta.url);`,
	`const __dirname = __esbuild_dirname(__filename);`,
].join('\n')

export interface CompanionThreadEntry {
	/** Entrypoint path, relative to the companion workspace. */
	in: string
	/** Output bundle basename (no extension). */
	out: string
	/** Must match the Node version the host runs this entrypoint under. */
	target: 'node22' | 'node26'
}

/**
 * The worker-thread / module-subprocess entrypoints. Shared so the production build and the dev
 * bundler always build the same set, at the same targets.
 */
export const companionThreadEntryPoints: CompanionThreadEntry[] = [
	{ in: 'lib/Graphics/Thread.ts', out: 'RenderThread', target: 'node26' },
	{ in: 'lib/ImportExport/Thread.ts', out: 'ImportExportThread', target: 'node26' },
	{ in: 'lib/Instance/Surface/Thread/Entrypoint.ts', out: 'SurfaceThread', target: 'node22' },
	{ in: 'lib/Instance/Connection/Thread/Entrypoint.ts', out: 'ConnectionThread', target: 'node22' },
]

export interface CompanionEsbuildOptions {
	/**
	 * Whether these are the shipped/packaged bundles. Sets COMPANION_BUNDLED (so isPackaged() is
	 * true) and enables minification by default. Dev bundles leave this false so their runtime
	 * resource resolution matches the TypeScript source tree.
	 */
	packaged: boolean
	/** Override minification (production disables it under ESBUILD_IN_DEV_MODE). */
	minify?: boolean
}

/**
 * Base esbuild options shared by every Companion node bundle. Callers add entryPoints, outdir,
 * absWorkingDir, target and plugins.
 */
export function companionEsbuildBaseOptions(opts: CompanionEsbuildOptions): BuildOptions {
	return {
		platform: 'node',
		format: 'esm',
		bundle: true,
		// Resolve @companion-app/shared to its raw TypeScript sources, so there is no separate
		// `tsc` emit to depend on.
		conditions: ['companion:source'],
		sourcemap: 'linked',
		external: companionNativeExternals,
		minify: opts.minify ?? opts.packaged,
		define: {
			...(opts.packaged ? { 'process.env.COMPANION_BUNDLED': '"1"' } : {}),
			'process.env.WS_NO_UTF_8_VALIDATE': '"1"',
		},
		banner: { js: nodeCompatBanner },
	}
}

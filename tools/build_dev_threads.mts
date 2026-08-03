import path from 'node:path'
import * as esbuild from 'esbuild'
import { companionEsbuildBaseOptions, companionThreadEntryPoints } from './companion-esbuild.mts'

/**
 * Dev-only helper. The main backend runs directly from TypeScript source via `tsx watch`, but the
 * worker-thread and module-subprocess entrypoints cannot: a worker entry must be a real file, and
 * the module subprocesses run under Node's `--permission` sandbox with a stripped env where a tsx
 * loader is not available. So we bundle just those entrypoints with esbuild - reusing the exact
 * production config (see companion-esbuild.mts) - and point the dev thread-spawn paths at the
 * results via COMPANION_DEV_THREAD_DIR. This keeps `tsc` out of the dev loop entirely.
 *
 * The bundles are emitted to companion/dist/threads (not companion/dist) on purpose: that directory
 * sits at the same depth under the repo root as the source files (companion/lib/<area>/), so the
 * bundle's `import.meta.url` resolves `isPackaged()===false` resource paths (fonts, SENTRY, ...) to
 * exactly the same locations the source tree does. A flat companion/dist would be one level too
 * shallow and the render thread's font lookup (`../../../assets/Fonts`) would miss.
 */

const companionDir = path.resolve(import.meta.dirname, '../companion')

/** Where the dev thread bundles are written; also consumed by the thread-spawn sites via env. */
export const devThreadOutDir = path.join(companionDir, 'dist', 'threads')

/**
 * Dev-only: keep everything in node_modules external and load it at runtime, rather than bundling
 * it. Production bundles native modules and copies their `.node` bindings alongside the output, but
 * in dev there is no copy step - a bundled native module (e.g. @julusian/image-rs) would look for
 * its binding relative to the bundle and fail. Externalizing matches how the old per-file tsc dev
 * build behaved (everything resolved from node_modules). @companion-app/shared is the exception: it
 * must be bundled from its TypeScript source, since there is no compiled output to resolve at runtime.
 */
const externalizeNodeModules: esbuild.Plugin = {
	name: 'dev-externalize-node-modules',
	setup(build) {
		build.onResolve({ filter: /^[^./]/ }, (args) => {
			if (args.path === '@companion-app/shared' || args.path.startsWith('@companion-app/shared/')) {
				return null // let esbuild resolve + bundle it from source
			}
			return { path: args.path, external: true }
		})
	},
}

// Build one esbuild context per target, matching the production build. Using a single target would
// down-level the higher-target entrypoints differently than they ship, which can change runtime
// behaviour - so each entrypoint is built at exactly the target it runs under.
const targets = [...new Set(companionThreadEntryPoints.map((e) => e.target))]

function buildOptionsForTarget(target: 'node22' | 'node26'): esbuild.BuildOptions {
	return {
		...companionEsbuildBaseOptions({ packaged: false }),
		absWorkingDir: companionDir,
		outdir: devThreadOutDir,
		target,
		entryPoints: companionThreadEntryPoints
			.filter((e) => e.target === target)
			.map(({ in: input, out }) => ({ in: input, out })),
		plugins: [externalizeNodeModules],
	}
}

/**
 * Start esbuild watchers for the dev thread entrypoints (one per target) and resolve once the first
 * build of each has completed, so the backend never spawns a thread before its bundle exists. The
 * contexts are left running for the lifetime of the dev process.
 */
export async function startDevThreadBuild(): Promise<esbuild.BuildContext[]> {
	const contexts = await Promise.all(targets.map((target) => esbuild.context(buildOptionsForTarget(target))))
	await Promise.all(contexts.map((ctx) => ctx.rebuild()))
	await Promise.all(contexts.map((ctx) => ctx.watch()))
	return contexts
}

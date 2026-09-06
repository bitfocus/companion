import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin } from 'vite'
import { recordBundleInputs, type RecordedBundleInputs } from './inputs.mts'

export interface RecordLicenseInputsOptions {
	/** Name this bundle is recorded under, which prefixes its diagnostics */
	name: string
	/**
	 * Packages which contribute their own runtime code to the output, rather than only transforming ours. Vite copies
	 * its module preload polyfill into the entry chunk, and rolldown injects the syntax helpers it downlevels to, so
	 * both ship inside the bundle even though neither is a dependency of the app.
	 *
	 * They cannot be found any other way: that code reaches the bundle as an id which is not a path, so nothing
	 * resolves it to a package on disk. The diagnostics list every such id, to make it obvious when a bundler upgrade
	 * starts injecting something these do not cover.
	 */
	bundlerRuntimePackages: string[]
}

/**
 * Vite has no equivalent of an esbuild metafile, so record which modules Rollup actually put into the emitted
 * chunks. The webui bundle is shipped as webui.zip and the launcher UI is packed into the application, so both need
 * their dependencies' licenses carrying in the same inventory as the node bundles.
 */
export function recordLicenseInputs(options: RecordLicenseInputsOptions): Plugin {
	return {
		name: 'companion-record-license-inputs',
		apply: 'build',
		async generateBundle(_outputOptions, bundle) {
			const inputs = new Set<string>()
			const generatedModuleIds = new Set<string>()

			const require = createRequire(path.join(process.cwd(), 'package.json'))
			for (const packageName of options.bundlerRuntimePackages) {
				// The package.json rather than the package root, so that it is a file the inventory can read
				inputs.add(require.resolve(`${packageName}/package.json`))
			}

			for (const output of Object.values(bundle)) {
				if (output.type !== 'chunk') continue
				for (const moduleId of Object.keys(output.modules)) {
					// Rollup and its plugins address generated modules by ids which are not files: a leading NUL marks a
					// plugin's virtual module, and a `?` suffix marks a transformed view of a real one.
					const [filePath] = moduleId.split('?')
					if (moduleId.includes('\0') || !path.isAbsolute(filePath)) {
						generatedModuleIds.add(moduleId.replaceAll('\0', ''))
						continue
					}
					inputs.add(filePath)
				}
			}

			// Reported as one line rather than one per module, so that it stays readable while still showing every id
			// covered by the declared packages, which is the only way to notice the bundler starting to inject more.
			const diagnostics = generatedModuleIds.size
				? [
						`${generatedModuleIds.size} generated modules are covered by ${options.bundlerRuntimePackages.join(', ')}: ${[...generatedModuleIds].sort().join(', ')}`,
					]
				: []
			await recordBundleInputs(options.name, { inputs: [...inputs], diagnostics } satisfies RecordedBundleInputs)
		},
	}
}

/**
 * Development-only entrypoint.
 *
 * This file is launched by `tsx watch` (see tools/dev.mts) so that tsx owns watching and restarting
 * the backend's TypeScript sources - it does that more accurately than a hand-rolled watcher, since
 * it follows the actual import graph. It is NOT part of the production build: it is never listed as
 * an esbuild entrypoint and nothing in the shipped app imports it.
 *
 * Its only responsibility beyond the normal entrypoint is hot-reloading "local dev" modules (those
 * passed via --extra-module-path). Those modules live outside the import graph, so tsx cannot watch
 * them. We watch that directory here, in the same process as the backend, and deliver a reload by
 * emitting the same `message` event the Registry already listens for (see Registry.ts) - no IPC or
 * socket is needed because the watcher and the app share this process.
 */

import path from 'node:path'
import chokidar from 'chokidar'
import debounceFn from 'debounce-fn'
// Start the backend. Under tsx this resolves to ./main.ts and runs normal startup as a side effect.
import './main.js'

const devModulesPath = process.env.COMPANION_DEV_MODULES_PATH
if (devModulesPath) {
	const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', '.yarn', '.cache', '.turbo', 'coverage', '.nyc_output'])
	const WATCHED_FILE_EXTENSIONS = ['.mjs', '.js', '.cjs', '.json']

	const isIgnoredPath = (filePath: string, stats: { isFile(): boolean } | undefined): boolean => {
		if (filePath.split(/[\\/]/).some((segment) => IGNORED_DIR_NAMES.has(segment))) return true

		const looksLikeFile = stats?.isFile() ?? path.extname(filePath) !== ''
		if (looksLikeFile) return !WATCHED_FILE_EXTENSIONS.some((ext) => filePath.endsWith(ext))

		return false
	}

	const cachedDebounces = new Map<string, () => void>()

	chokidar
		.watch('.', {
			cwd: devModulesPath,
			ignoreInitial: true,
			ignored: isIgnoredPath,
		})
		.on('all', (_event, filename) => {
			const moduleDirName = filename.split(path.sep)[0]

			let fn = cachedDebounces.get(moduleDirName)
			if (!fn) {
				fn = debounceFn(
					() => {
						console.log('Sending reload for module:', moduleDirName)
						// Deliver in-process: the Registry's `process.on('message')` handler picks this up.
						// Emitting `message` fires those listeners even though there is no IPC channel here.
						// Cast to the generic EventEmitter so we bypass the typed `message` overload.
						;(process as NodeJS.EventEmitter).emit('message', {
							messageType: 'reload-extra-module',
							fullpath: path.join(devModulesPath, moduleDirName),
						})
					},
					{ after: true, before: false, wait: 1000 }
				)
				cachedDebounces.set(moduleDirName, fn)
			}

			fn()
		})
		.on('error', (error) => {
			console.warn(`Module watcher error: ${error}`)
		})
}

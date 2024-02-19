#!/usr/bin/env node

import chokidar from 'chokidar'
import { $ } from 'zx/core'
import path from 'path'
import debounceFn from 'debounce-fn'
import { fileURLToPath } from 'url'
import concurrently from 'concurrently'

let node

const devModulesPath = argv['extra-module-path'] ? path.resolve(argv['extra-module-path']) : undefined

concurrently([
	{
		command: `yarn dev --preserveWatchOutput`,
		cwd: '../shared-lib',
	},
]).result.catch((e) => {
	console.error(e)

	if (node) {
		node.kill()
	}

	process.exit(1)
})

const cachedDebounces = {}

chokidar
	.watch(['**/*.mjs', '**/*.js', '**/*.cjs', '**/*.json'], {
		ignoreInitial: true,
		cwd: '..',
		ignored: ['**/node_modules/**', 'webui', 'launcher', 'module-local-dev', 'tools', 'test'],
	})
	.on('all', (event, filename) => {
		// Something else changed
		restart()
	})

chokidar
	.watch(['**/*.mjs', '**/*.js', '**/*.cjs', '**/*.json'], {
		ignoreInitial: true,
		cwd: devModulesPath,
		ignored: ['**/node_modules/**'],
	})
	.on('all', (event, filename) => {
		const moduleDirName = filename.split(path.sep)[0]
		// Module changed

		let fn = cachedDebounces[moduleDirName]
		if (!fn) {
			fn = debounceFn(
				() => {
					console.log('Sending reload for module:', moduleDirName)
					if (node) {
						node.send({
							messageType: 'reload-extra-module',
							fullpath: path.join(devModulesPath, moduleDirName),
						})
					}
				},
				{
					after: true,
					before: false,
					wait: 100,
				}
			)
			cachedDebounces[moduleDirName] = fn
		}

		fn()
	})

await start()

async function start() {
	node = $.spawn('node', ['main.js', ...process.argv.slice(3)], {
		stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
		cwd: fileURLToPath(new URL('../companion', import.meta.url)),
		env: {
			...process.env,

			COMPANION_DEV_MODULES: '1',
		},
	})
}

const restart = debounceFn(
	() => {
		if (node) {
			// Check if process has already exited
			if (node.exitCode !== null) node = null

			// Try and kill the process
			if (node && !node.kill()) {
				console.error('Failed to kill')
				process.exit(1)
			}
		}

		console.log('********')
		console.log('RESTARTING')
		console.log('********')

		if (!node) {
			start()
		} else if (node.listenerCount('close') === 0) {
			node.on('close', () => {
				node = null
				start()
			})
		}
	},
	{
		after: true,
		before: false,
		wait: 100,
	}
)

function signalHandler(signal) {
	process.exit()
}

// Make sure to exit on interrupt
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

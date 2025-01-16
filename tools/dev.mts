#!/usr/bin/env node

import chokidar from 'chokidar'
import { $, usePowerShell, argv } from 'zx'
import path from 'path'
import fs from 'fs'
import debounceFn from 'debounce-fn'
import { fileURLToPath } from 'url'
import concurrently from 'concurrently'
import dotenv from 'dotenv'
import { fetchNodejs } from './fetch_nodejs.mts'
import { determinePlatformInfo } from './build/util.mts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

await $`tsx ../tools/build_writefile.mts`

dotenv.config({
	path: path.resolve(process.cwd(), '..', '.env'),
})

let node

const rawDevModulesPath = process.env.COMPANION_DEV_MODULES || argv['extra-module-path']
const devModulesPath = rawDevModulesPath ? path.resolve(rawDevModulesPath) : undefined

if (devModulesPath) {
	const argvIndex = process.argv.indexOf('--extra-module-path')
	if (argvIndex === -1) {
		process.argv.push('--extra-module-path', devModulesPath)
	} else {
		process.argv[argvIndex + 1] = devModulesPath
	}
}

console.log('Ensuring nodejs binaries are available')

const platformInfo = determinePlatformInfo(undefined)
await fetchNodejs(platformInfo)

console.log('Ensuring bundled modules are synced')

await $`git submodule init`
await $`git submodule sync`
await $`git submodule update`

console.log('Performing first build of components')

if (!fs.existsSync('../shared-lib/dist')) {
	await $`yarn workspace @companion-app/shared build:ts`.catch((e) => {
		console.error(e)
	})
}
if (!fs.existsSync('../companion/dist')) {
	await $`yarn workspace companion build`.catch((e) => {
		console.error(e)
	})
}
if (!fs.existsSync('../webui/build')) {
	await $`yarn workspace @companion-app/webui build`.catch((e) => {
		console.error(e)
	})
} else {
	console.warn('Skipping webui build, you may need to run `yarn dist:webui` if changes have been made recently')
}

console.log('Starting typescript watchers')

concurrently([
	{
		command: `yarn dev --preserveWatchOutput`,
		cwd: '../shared-lib',
		name: 'shared-lib',
	},
	{
		command: `yarn build:watch --preserveWatchOutput`,
		cwd: '../companion',
		name: 'companion',
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

if (devModulesPath) {
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
						wait: 1000,
					}
				)
				cachedDebounces[moduleDirName] = fn
			}

			fn()
		})
}

async function start() {
	node = $.spawn('node', ['dist/main.js', ...process.argv.slice(3)], {
		stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
		cwd: fileURLToPath(new URL('../companion', import.meta.url)),
		env: {
			...process.env,

			COMPANION_DEV_MODULES: '1',
		},
	})
}

let canStart = false
const restart = debounceFn(
	() => {
		if (!canStart) return

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
		wait: 1000,
	}
)

function signalHandler(signal) {
	process.exit()
}

// Make sure to exit on interrupt
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

// Trigger a start soon
setTimeout(() => {
	console.log('Starting application')
	canStart = true

	restart()
}, 3000)

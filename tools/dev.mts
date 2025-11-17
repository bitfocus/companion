#!/usr/bin/env node

import chokidar from 'chokidar'
import { $, usePowerShell, argv } from 'zx'
import path from 'path'
import fs from 'fs'
import debounceFn from 'debounce-fn'
import concurrently from 'concurrently'
import dotenv from 'dotenv'
import { fetchNodejs } from './fetch_nodejs.mts'
import { determinePlatformInfo } from './build/util.mts'
import { ChildProcess } from 'child_process'
import semver from 'semver'
import { parseEnv } from 'util'
import { fetchBuiltinSurfaceModules } from './fetch_builtin_modules.mts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

await $`tsx ../tools/build_writefile.mts`

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const nodeJsValidRange = new semver.Range(packageJson.engines.node)
if (!semver.satisfies(process.versions.node, nodeJsValidRange)) {
	console.error(
		`This project requires Node.js version ${nodeJsValidRange} but you are using version ${process.versions.node}.`
	)
	console.error('Please update your Node.js installation.')
	process.exit(1)
}

let node: ChildProcess | null = null
const nodeArgs: string[] = []

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

const inspectIndex = process.argv.findIndex((arg) => arg.startsWith('--inspect'))
if (inspectIndex !== -1) {
	const inspectArg = process.argv[inspectIndex]
	process.argv.splice(inspectIndex, 1)
	nodeArgs.push(inspectArg)
}

console.log('Ensuring nodejs binaries are available')

const platformInfo = determinePlatformInfo(undefined)
await fetchNodejs(platformInfo)

console.log('Ensuring builtin modules are installed')

await fetchBuiltinSurfaceModules(true)

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
		command: `yarn build:watch --preserveWatchOutput`,
		cwd: '../',
		name: 'tsc',
	},
]).result.catch((e) => {
	console.error(e)

	if (node) {
		node.kill()
	}

	process.exit(1)
})

const cachedDebounces = {} as Record<string, any>

chokidar
	.watch('..', {
		ignoreInitial: true,
		ignored: (path, stats) => {
			if (
				stats?.isFile() &&
				!path.endsWith('.mjs') &&
				!path.endsWith('.js') &&
				!path.endsWith('.cjs') &&
				!path.endsWith('.json')
			) {
				return true
			}
			if (
				path.includes('node_modules') ||
				path.includes('webui') ||
				path.includes('launcher') ||
				path.includes('module-local-dev') ||
				path.includes('tools') ||
				path.includes('test')
			) {
				return true
			}
			return false
		},
	})
	.on('all', (event, filename) => {
		if (filename.endsWith('shared-lib/lib/Paths.mts')) {
			// Exit when the paths change, as that usually means the config dir will have changed, and that may not be detected fast enough
			console.warn('Config paths changed, exiting')
			process.exit(0)
		}
		// Something else changed
		restart()
	})
	.on('error', (error) => {
		console.warn(`Watcher error: ${error}`)
	})

if (devModulesPath) {
	chokidar
		.watch('.', {
			cwd: devModulesPath,
			ignoreInitial: true,
			ignored: (path, stats) => {
				if (
					stats?.isFile() &&
					!path.endsWith('.mjs') &&
					!path.endsWith('.js') &&
					!path.endsWith('.cjs') &&
					!path.endsWith('.json')
				) {
					return true
				}
				if (path.includes('node_modules')) {
					return true
				}
				return false
			},
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
		.on('error', (error) => {
			console.warn(`Module watcher error: ${error}`)
		})
}

async function start() {
	node = $.spawn('node', [...nodeArgs, 'dist/main.js', ...process.argv.slice(3)], {
		stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
		cwd: path.join(import.meta.dirname, '../companion'),
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

function signalHandler(signal: NodeJS.Signals) {
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

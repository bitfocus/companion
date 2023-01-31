#!/usr/bin/env node

import chokidar from 'chokidar'
import { $ } from 'zx/core'
import path from 'path'
import debounceFn from 'debounce-fn'

let node

const devModulesPath = argv['extra-module-path'] ? path.resolve(argv['extra-module-path']) : undefined

const cachedDebounces = {}

chokidar
	.watch(['**/*.mjs', '**/*.js', '**/*.cjs', '**/*.json'], {
		ignoreInitial: true,
		ignored: ['**/node_modules/**', './webui/', './launcher/', './dist/'],
	})
	.on('all', (event, filename) => {
		const fullpath = path.resolve(filename)
		if (fullpath.startsWith(devModulesPath)) {
			const moduleDirName = fullpath.slice(devModulesPath.length + 1).split('/')[0]
			// Module changed

			let fn = cachedDebounces[moduleDirName]
			if (!fn) {
				fn = debounceFn(
					() => {
						console.log('Sending reload for module:', moduleDirName)
						node.send({
							messageType: 'reload-extra-module',
							fullpath: path.join(devModulesPath, moduleDirName),
						})
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
		} else {
			// Something else changed
			restart()
		}
	})

await start()

async function start() {
	node = $.spawn('node', ['main.js', ...process.argv.slice(3)], {
		stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
		env: {
			...process.env,
			COMPANION_DEV_MODULES: '1',
		},
	})
}

function restart() {
	if (!node.kill()) {
		console.error('Failed to kill')
		process.exit(1)
	}

	console.log('********')
	console.log('RESTARTING')
	console.log('********')

	node.on('exit', () => start())
}

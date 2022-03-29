#!/usr/bin/env node
import Registry from './lib/Registry.js'

console.log('Starting')

if (process.argv.length < 3) {
	console.log('Usage: ./headless.js <address> [port]')
	console.log('')
	console.log('Example: ./headless.js 192.168.81.1')
	process.exit(1)
}

let configDir
if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
	configDir = process.env.COMPANION_CONFIG_BASEDIR
} else {
	configDir = process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME']
}

;(async () => {
	const registry = await Registry.create(configDir)

	var port = '8000'
	if (process.argv[3] != null) {
		port = Number(process.argv[3])
	}

	setTimeout(function () {
		registry.ready(process.argv[2], port, !process.env.DEVELOPER)
		console.log('Started')
	}, 1000)
})()

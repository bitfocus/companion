#!/usr/bin/env node
var App = require('./app.js')

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
	const system = await App.create(configDir)

	var port = '8000'
	if (process.argv[3] != null) {
		port = process.argv[3]
	}

	setTimeout(function () {
		system.emit('skeleton-bind-ip', process.argv[2])
		system.emit('skeleton-bind-port', port)
		system.ready(!process.env.DEVELOPER)
		console.log('Started')
	}, 1000)
})()

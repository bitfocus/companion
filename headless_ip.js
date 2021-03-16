#!/usr/bin/env node
var system = require('./app.js')

console.log('Starting')

if (process.argv.length < 3) {
	console.log('Usage: ./headless.js <address> [port]')
	console.log('')
	console.log('Example: ./headless.js 192.168.81.1')
	process.exit(1)
}

if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
	system.emit('skeleton-info', 'configDir', process.env.COMPANION_CONFIG_BASEDIR)
} else {
	system.emit('skeleton-info', 'configDir', process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'])
}

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

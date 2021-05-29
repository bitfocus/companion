#!/usr/bin/env node
var companion = require('./lib/registry.js')

console.log('Starting')

if (process.argv.length < 3) {
	console.log('Usage: ./headless.js <address> [port]')
	console.log('')
	console.log('Example: ./headless.js 192.168.81.1')
	process.exit(1)
}

if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
	companion.cfgDir = process.env.COMPANION_CONFIG_BASEDIR
} else {
	companion.cfgDir = process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME']
}

var port = '8000'
if (process.argv[3] != null) {
	port = process.argv[3]
}

setTimeout(function () {
	companion.bindIp = process.argv[2]
	companion.bindPort = port
	companion.launch(!process.env.DEVELOPER)
	console.log('Started')
}, 1000)

/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

if (process.env.DEVELOPER !== undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects'
}

global.MAX_BUTTONS = 32
global.MAX_BUTTONS_PER_ROW = 8

const Config = require('./lib/Data/Config')
const Registry = require('./lib/registry')
const EventEmitter = require('events')
const fs = require('fs')
const mkdirp = require('mkdirp')
const stripAnsi = require('strip-ansi')

/**
 * The application's event emitter for core functionality which allows for some point to multi-point calls
 * and `skeleton` to `app` functionality.
 * @extends EventEmitter
 */
class App extends EventEmitter {
	buildNumber
	cfgDir
	config
	debug = require('debug')('App')
	logbuffer = []
	logwriting = false
	pkgInfo = require('./package.json')
	registry
	skeletonInfo
	system = new EventEmitter()

	constructor() {
		super()

		this.buildNumber = fs
			.readFileSync(__dirname + '/BUILD')
			.toString()
			.trim()

		this.skeletonInfo = {
			appName: this.pkgInfo.description,
			appVersion: this.pkgInfo.version,
			appBuild: this.buildNumber.replace(/-*master-*/, '').replace(/^-/, ''),
			appStatus: 'Starting',
		}
	}

	exit() {
		console.log('somewhere, the system wants to exit. kthxbai')

		if (this.registry !== undefined) {
			this.registry.quit()
		}

		setImmediate(() => {
			process.exit()
		})
	}

	getSkeletonInfo() {
		return this.skeletonInfo
	}

	launch(logToFile) {
		if (logToFile) {
			this.debug('Going into headless mode. Logs will be written to companion.log')
			this.startLogging()
		}

		this.debug('launching registry')
		this.registry = new Registry(this)

		this.system.emit('modules_loaded')
	}

	restart() {
		console.log('somewhere, the system wants to restart. kthxbai')

		if (this.registry !== undefined) {
			this.registry.quit()
		}

		this.emit('restart')
	}

	setBindIp(ip) {
		this.config.setKey('bind_ip', ip)

		if (this.registry !== undefined) {
			this.registry.server.listenForHttp()
		}
	}

	setBindPort(port) {
		var p = parseInt(port)

		if (p >= 1024 && p <= 65535) {
			this.config.setKey('http_port', p)
			if (this.registry !== undefined) {
				this.registry.server.listenForHttp()
			}
		}
	}

	setConfigDir(dir) {
		this.skeletonInfo['configDir'] = dir

		this.debug('configuration directory', dir)
		this.cfgDir = dir + '/companion/'

		mkdirp(this.cfgDir, (err) => {
			this.debug('mkdirp', this.cfgDir, err)

			this.config = new Config(this.system, this.cfgDir, {
				http_port: 8888,
				bind_ip: '127.0.0.1',
				start_minimised: false,
			})

			this.emit('skeleton-info', 'configDir', dir)
			this.emit('skeleton-info', 'appURL', 'Waiting for webserver..')
			this.emit('skeleton-info', 'startMinimised', this.config.getKey('start_minimised'))
		})
	}

	setStartMinimised(minimised) {
		this.config.setKey('start_minimised', minimised)
	}

	startLogging() {
		setInterval(() => {
			if (this.logbuffer.length > 0 && this.logwriting == false) {
				var writestring = this.logbuffer.join('\n')
				this.logbuffer = []
				this.logwriting = true
				fs.appendFile('./companion.log', writestring + '\n', (err) => {
					if (err) {
						console.log('log write error', err)
					}
					this.logwriting = false
				})
			}
		}, 1000)

		process.stderr.write = () => {
			var arr = []
			for (var n in arguments) {
				arr.push(arguments[n])
			}
			var line = new Date().toISOString() + ' ' + stripAnsi(arr.join(' ').trim())
			this.logbuffer.push(line)
		}
	}
}

exports = module.exports = new App()

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

if (process.env.DEVELOPER !== undefined && process.env.DEBUG === undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects'
}

global.MAX_BUTTONS = 32
global.MAX_BUTTONS_PER_ROW = 8

var EventEmitter = require('events')
var fs = require('fs-extra')
var debug = require('debug')('app')
var stripAnsi = require('strip-ansi')
var shortid = require('shortid')
var path = require('path')

var logbuffer = []
var logwriting = false

const pkgInfo = require('./package.json')
let buildNumber
try {
	buildNumber = fs
		.readFileSync(__dirname + '/BUILD')
		.toString()
		.trim()
} catch (e) {
	console.error('Companion cannot start as the "BUILD" file is missing')
	console.error('If you are running from source, you can generate it by running: yarn build:writefile')
	process.exit(1)
}

class App extends EventEmitter {
	/**
	 * @param {string} configDirPrefix
	 */
	static async create(configDirPrefix) {
		debug('configuration directory', configDirPrefix)
		const configDir = configDirPrefix + '/companion/'
		await fs.ensureDir(configDir)

		// load the machine id
		let machineId = shortid.generate()
		const machineIdPath = path.join(configDir, 'machid')
		if (await fs.pathExists(machineIdPath)) {
			let text = ''
			try {
				text = await fs.readFile(machineIdPath)
				if (text) {
					machineId = text.toString()
					debug('read machid', machineId)
				}
			} catch (e) {
				debug('error reading uuid-file', e)
			}
		} else {
			debug('creating uuid file')
			await fs.writeFile(machineIdPath, umachineIduid).catch((e) => {
				debug(`failed to write uuid file`, e)
			})
		}

		return new App(configDir, machineId)
	}

	/**
	 * @access private
	 * @param {Object} config
	 * @param {string} configDir
	 * @param {string} machineId
	 */
	constructor(configDir, machineId) {
		super()

		this.configDir = configDir
		this.machineId = machineId
		this.appVersion = pkgInfo.version
		this.appBuild = buildNumber.replace(/-*master-*/, '').replace(/^-/, '')

		// Supress warnings for too many listeners to io_connect. This can be safely increased if the warning comes back at startup
		this.setMaxListeners(20)

		this.on('exit', () => {
			console.log('somewhere, the system wants to exit. kthxbai')

			this.emit('instance_getall', function (instances, active) {
				try {
					for (var key in active) {
						if (instances[key].label !== 'internal') {
							try {
								active[key].destroy()
							} catch (e) {
								console.log('Could not destroy', instances[key].label)
							}
						}
					}
				} catch (e) {
					console.log('Could not destroy all instances')
				}
			})

			setImmediate(function () {
				process.exit()
			})
		})
	}

	/**
	 * Rebind the http server to an ip and port (https will update to the same ip if running)
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	rebindHttp(bind_ip, http_port) {
		// ensure the port looks reasonable
		if (http_port < 1024 || http_port > 65535) {
			http_port = 8000
		}

		this.emit('http_rebind', bind_ip, http_port)
	}

	/**
	 * Startup the application, and bind the http server to an ip and port
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	ready(bind_ip, http_port, logToFile) {
		if (logToFile) {
			debug('Going into headless mode. Logs will be written to companion.log')

			setInterval(function () {
				if (logbuffer.length > 0 && logwriting == false) {
					var writestring = logbuffer.join('\n')
					logbuffer = []
					logwriting = true
					fs.appendFile('./companion.log', writestring + '\n', function (err) {
						if (err) {
							console.log('log write error', err)
						}
						logwriting = false
					})
				}
			}, 1000)

			process.stderr.write = function () {
				var arr = []
				for (var n in arguments) {
					arr.push(arguments[n])
				}
				var line = new Date().toISOString() + ' ' + stripAnsi(arr.join(' ').trim())
				logbuffer.push(line)
			}
		}

		var io = require('./lib/Interface')(this)
		var db = require('./lib/Database')(this)
		var data = require('./lib/Data')(this)
		var page = require('./lib/Page')(this)
		var schedule = require('./lib/Trigger')(this)
		var bank = require('./lib/Bank')(this)
		var graphics = require('./lib/Graphics')(this)
		var elgatoDM = require('./lib/Surface')(this)
		var instance = require('./lib/Instance')(this)
		var service = require('./lib/Service')(this, io)

		this.emit('modules_loaded')

		this.rebindHttp(bind_ip, http_port)

		this.on('exit', function () {
			elgatoDM.quit()
		})
	}
}

exports = module.exports = App

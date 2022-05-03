import UIHandler from '../UI/Handler.js'
import DataUserConfig from '../Data/UserConfig.js'
import { cloneDeep } from 'lodash-es'
import createDebug from 'debug'
import { Severity } from '@sentry/node'
import sentryElectron from './Electron.js'
import sentryNode from './Node.js'
import util from 'util'
import path from 'path'
import stripAnsi from 'strip-ansi'
import FileStreamRotator from 'file-stream-rotator'
import fs from 'fs-extra'

const SentrySeverity = {
	debug: Severity.Debug,
	info: Severity.Info,
	warn: Severity.Warning,
	error: Severity.Error,
}

/**
 * Logger for messages to send to the user in the UI
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.12
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class LogController {
	/**
	 * The Sentry <code>addBreadcrumb</code> function, if initialized
	 * @type {function}
	 * @access protected
	 */
	addBreadcrumb = null
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = createDebug('lib/Log/Controller')
	debuggers = {}
	/**
	 * The log array
	 * @type {Array[]}
	 * @access protected
	 */
	history = []
	logbuffer = []
	logToFile = !process.env.DEVELOPER
	logWriter = null
	logwriting = false
	/**
	 * The application core
	 * @type {Registry}
	 * @access protected
	 */
	registry = null

	/**
	 * Create a new logger
	 */
	constructor() {
		this.logLevel = 'debug'
		this.debug('starting logger')
		this.add('log', 'info', 'Application started')
		this.register('console', 'Console')
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('log_clear', () => {
			client.broadcast.emit('log_clear')
			this.history = []
			this.io.emit('log', Date.now(), 'log', 'info', 'Log cleared')
		})
		client.on('log_catchup', () => {
			cb(this.history)
		})
	}

	/**
	 * Log and send a message to the UI
	 * @param {string} source - the name of the module sending the log
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {...string} message - the message to print
	 * @access public
	 */
	add(source, level, ...messages) {
		let message = util.format(...messages)

		if (level) {
			let time = new Date()
			let now = time.valueOf()
			let nowIso = time.toISOString()

			if (process.env.DEVELOPER || (this.logLevel == 'prod' && level != 'debug') || this.logLevel == 'debug') {
				this.io?.emit('log', now, source, level, message)

				this.history.push([now, source, level, message])
				if (this.history.length > 2000) {
					this.history.shift()
				}

				if (typeof this.addBreadcrumb === 'function') {
					this.addBreadcrumb({
						category: 'source',
						level: SentrySeverity[level],
						message: message,
					})
				}

				if (this.logWriter) {
					let line = `${nowIso} ${level.toUpperCase()} ${source}: ${message}`
					this.logbuffer.push(line)
				}

				if (this.debuggers[source]) {
					this.debuggers[source](message)
				}
			}
		}
	}

	/**
	 *
	 * @access public
	 */
	close() {
		this.writeLog()
	}

	/**
	 * Get all of the log entries
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a reference
	 * @return {Array[]} the log entries
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.debug(`get all`)

		if (clone === true) {
			out = cloneDeep(this.history)
		} else {
			out = this.history
		}

		return out
	}

	/**
	 * Initialize Sentry and UI logging
	 * @param {Registry} registry
	 * @access public
	 */
	init(registry) {
		this.registry = registry

		let sentryDsn
		try {
			sentryDsn = fs
				.readFileSync(new URL('../../SENTRY', import.meta.url))
				.toString()
				.trim()
		} catch (e) {
			console.log('Sentry DSN not located')
		}

		if (/**process.env.DEVELOPER === undefined &&**/ sentryDsn && sentryDsn.substring(0, 8) == 'https://') {
			this.register('sentry', 'Sentry')

			if (global.electron && global.electron.app) {
				this.addBreadcrumb = sentryElectron(registry, sentryDsn)
			} else {
				this.addBreadcrumb = sentryNode(registry, sentryDsn)
			}
		} else {
			console.log('Sentry error reporting is disabled')
		}

		this.logLevel = this.userconfig.getKey('log_level')
		this.resetHistory()
	}

	/**
	 * The core interface client
	 * @type {UIHandler}
	 * @access protected
	 * @readonly
	 */
	get io() {
		if (this.registry && this.registry.io) {
			return this.registry.io
		}
	}

	/**
	 * Create a debugger for a module if one does not already exist
	 * @param {string} logSource - module name to be used in UI logs
	 * @param {string} debugNamespace - module path to be used in the debugger
	 * @access public
	 */
	register(logSource, debugNamespace) {
		if (!this.logToFile && this.debuggers[logSource] === undefined) {
			this.debuggers[logSource] = debug(debugNamespace)
		}
	}

	resetHistory() {
		if (this.logLevel != 'debug') {
			let newHistory = []

			this.io.emit('log_clear')

			for (const id in this.history) {
				let log = this.history[id]
				if (log[2] != 'debug') {
					newHistory.push(log)
					this.io.emit('log', log[0], log[1], log[2], log[3])
				}
			}

			this.history = newHistory
		}
	}

	/**
	 * Setup config directory for log rotation
	 * @param {string} configDir - the config directory
	 * @access public
	 */
	setConfigDir(configDir) {
		if (this.logToFile) {
			debug('Going into headless mode. Logs will be written to companion.log')

			this.logWriter = FileStreamRotator.getStream({
				filename: path.join(configDir, './companion'),
				size: '1m',
				max_logs: '5',
				audit_file: path.join(configDir, './logaudit.json'),
				extension: '.log',
			})

			setInterval(this.writeLog.bind(this), 10000)

			process.stderr.write = () => {
				var arr = []
				for (var n in arguments) {
					arr.push(arguments[n])
				}
				this.add('console', 'error', stripAnsi(arr.join(' ').trim()))
			}

			process.stdout.write = () => {
				var arr = []
				for (var n in arguments) {
					arr.push(arguments[n])
				}
				this.add('console', 'debug', stripAnsi(arr.join(' ').trim()))
			}
		}
	}

	/**
	 * The core user config manager
	 * @type {DataUserConfig}
	 * @access protected
	 * @readonly
	 */
	get userconfig() {
		return this.registry.userconfig
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (key == 'log_level') {
			this.logLevel = value
			this.resetHistory()
		}
	}

	/**
	 *
	 * @access protected
	 */
	writeLog() {
		if (this.logbuffer.length > 0 && this.logwriting == false && this.logWriter) {
			var writestring = this.logbuffer.join('\n')
			this.logbuffer = []
			this.logwriting = true
			try {
				this.logWriter.write(writestring + '\n')
			} catch (e) {
				console.log(e.message)
			}
			this.logwriting = false
		}
	}
}

// Get this thing started right away!
// This shouldn't happen here, but some sequencing things with the imports means it does for now
global.logger = new LogController()

export default LogController

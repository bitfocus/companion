/**
 * Warning: this file needs to not reference any 'real' code in the codebase, or we end up with import cycle issues
 */
import { cloneDeep } from 'lodash-es'
import createDebug from 'debug'
import { Severity } from '@sentry/node'
// import sentryNode from './Node.js'
import util from 'util'
import path from 'path'
import stripAnsi from 'strip-ansi'
import FileStreamRotator from 'file-stream-rotator'
import fs from 'fs-extra'
import winston from 'winston'
import Transport from 'winston-transport'
import supportsColor from 'supports-color'
import consoleColors from './Colors.js'

const SentrySeverity = {
	debug: Severity.Debug,
	info: Severity.Info,
	warn: Severity.Warning,
	error: Severity.Error,
}

class ToMemoryTransport extends Transport {
	constructor(opts, addToHistory) {
		super(opts)

		this.addToHistory = addToHistory
	}

	log(info, callback) {
		this.addToHistory(info)

		callback()
	}
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
	/**
	 * The log array
	 * @type {Array[]}
	 * @access protected
	 */
	history = []
	logToFile = !process.env.DEVELOPER
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

		function selectColor(namespace) {
			let hash = 0

			for (let i = 0; i < namespace.length; i++) {
				hash = (hash << 5) - hash + namespace.charCodeAt(i)
				hash |= 0 // Convert to 32bit integer
			}

			return consoleColors[Math.abs(hash) % consoleColors.length]
		}

		const myFormat = winston.format.printf(({ level, message, timestamp, source }) => {
			const color = selectColor(source)
			const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)
			const prefix = `${colorCode};1m${source} \u001B[0m`

			return `${timestamp} ${level}: ${prefix} ${message} `
		})

		this.winston = winston.createLogger({
			level: 'silly',
			transports: [
				// new winston.transports.File({ filename: 'combined.log' }),
				new winston.transports.Console({
					format: winston.format.combine(
						supportsColor.stdout ? winston.format.colorize() : undefined,
						winston.format.timestamp(),
						myFormat
					),
				}),
				new ToMemoryTransport(
					{
						level: 'debug',
						format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
					},
					this.addToHistory.bind(this)
				),
			],
		})

		this.logger = this.createLogger('Log/Controller')

		this.logger.info('Application started')
	}

	/** Create a child logger */
	createLogger(source) {
		return this.winston.child({ source })
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
		client.on('log_catchup', (cb) => {
			cb(this.history)
		})
	}

	/**
	 * Add a line logged to winston to the log history
	 * @param {object} line
	 * @access private
	 */
	addToHistory(line) {
		const uiLine = [line.timestamp, line.source, line.level, line.message]
		this.io?.emit('log', ...uiLine)

		this.history.push(uiLine)
		if (this.history.length > 2000) {
			this.history.shift()
		}

		if (typeof this.addBreadcrumb === 'function') {
			this.addBreadcrumb({
				category: 'source',
				level: SentrySeverity[line.level] || SentrySeverity.debug,
				message: `${line.source}: ${line.message}`,
			})
		}
	}

	/**
	 * Get all of the log entries
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a reference
	 * @return {Array[]} the log entries
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.logger.silly(`get all`)

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
			this.logger.info('Sentry DSN not located')
		}

		// if (/**process.env.DEVELOPER === undefined &&**/ sentryDsn && sentryDsn.substring(0, 8) == 'https://') {

		// 	this.addBreadcrumb = sentryNode(registry, sentryDsn)
		// } else {
		// 	console.log('Sentry error reporting is disabled')
		// }

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
		// if (this.logToFile) {
		// 	debug('Going into headless mode. Logs will be written to companion.log')
		// 	this.logWriter = FileStreamRotator.getStream({
		// 		filename: path.join(configDir, './companion'),
		// 		size: '1m',
		// 		max_logs: '5',
		// 		audit_file: path.join(configDir, './logaudit.json'),
		// 		extension: '.log',
		// 	})
		// 	process.stderr.write = () => {
		// 		var arr = []
		// 		for (var n in arguments) {
		// 			arr.push(arguments[n])
		// 		}
		// 		this.add('console', 'error', stripAnsi(arr.join(' ').trim()))
		// 	}
		// 	process.stdout.write = () => {
		// 		var arr = []
		// 		for (var n in arguments) {
		// 			arr.push(arguments[n])
		// 		}
		// 		this.add('console', 'debug', stripAnsi(arr.join(' ').trim()))
		// 	}
		// }
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

	setupLogToFile() {
		// TODO
		this.logger.info('Logging started')
	}
}

// Get this thing started right away!
// This shouldn't happen here, but some sequencing things with the imports means it does for now
const logger = new LogController()
global.logger = logger

export default logger

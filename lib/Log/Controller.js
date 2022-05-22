/**
 * Warning: this file needs to not reference any 'real' code in the codebase, or we end up with import cycle issues
 */
import { cloneDeep } from 'lodash-es'
import { Severity } from '@sentry/node'
import path from 'path'
import stripAnsi from 'strip-ansi'
import fs from 'fs-extra'
import winston from 'winston'
import Transport from 'winston-transport'
import supportsColor from 'supports-color'
import consoleColors from './Colors.js'
import 'winston-daily-rotate-file'
import { init, configureScope, addBreadcrumb } from '@sentry/node'
import '@sentry/tracing'

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
	 * The log array
	 * @type {Array[]}
	 * @access protected
	 */
	history = []
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

		if (process.env.JEST_WORKER_ID) {
			// Use a simpler log setup in tests
			this.winston = winston.createLogger({
				level: 'silly',
				transports: [
					new winston.transports.Console({
						format: winston.format.simple(),
					}),
				],
			})
		} else {
			this.winston = winston.createLogger({
				level: 'silly',
				transports: [
					new winston.transports.Console({
						format: winston.format.combine(
							supportsColor.stdout ? winston.format.colorize() : undefined,
							winston.format.timestamp(),
							winston.format.printf(({ level, message, timestamp, source }) => {
								const color = selectColor(source)
								const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)
								const prefix = `${colorCode};1m${source}\u001B[0m`

								return `${timestamp} ${level} ${prefix} ${message} `
							})
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
		}

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
		const uiLine = [line.timestamp, stripAnsi(line.source), line.level, stripAnsi(line.message)]
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
	getAllLines(clone = false) {
		this.logger.silly(`get all`)

		if (clone) {
			return cloneDeep(this.history)
		} else {
			return this.history
		}
	}

	/**
	 * Initialize Sentry and UI logging
	 * @param {Registry} registry
	 * @access public
	 */
	init(registry) {
		this.registry = registry

		// Allow the DSN to be provided as an env variable
		let sentryDsn = process.env.SENTRY_DSN
		if (!sentryDsn) {
			try {
				sentryDsn = fs
					.readFileSync(new URL('../../SENTRY', import.meta.url))
					.toString()
					.trim()
			} catch (e) {
				this.logger.info('Sentry DSN not located')
			}
		}

		if (sentryDsn && sentryDsn.substring(0, 8) == 'https://') {
			try {
				init({
					dsn: sentryDsn,
					release: `companion@${registry.appBuild || registry.appVersion}`,
					beforeSend(event) {
						if (event.exception) {
							console.log('sentry', 'error', event.exception)
						}
						return event
					},
				})

				configureScope((scope) => {
					scope.setUser({ id: registry.machineId })
					scope.setExtra('build', registry.appBuild)
				})
			} catch (e) {
				this.logger.info(`Failed to setup sentry reporting: ${e}`)
			}

			this.addBreadcrumb = addBreadcrumb
			this.logger.info(`Sentry error reporting configured`)
		} else {
			this.logger.info('Sentry error reporting is disabled')
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
	 * Setup logging to file
	 * @param {string} configDir - the config directory
	 * @access public
	 */
	setupLogToFile(configDir) {
		if (process.env.JEST_WORKER_ID) {
			this.logger.info('Skipping log file for tests')
		} else {
			const transport = new winston.transports.DailyRotateFile({
				filename: path.join(configDir, 'companion-%DATE%.log'),
				datePattern: 'YYYY-MM-DD-HH',
				maxSize: '20m',
				maxFiles: '7d',

				format: winston.format.combine(
					supportsColor.stdout ? winston.format.colorize() : undefined,
					winston.format.timestamp(),
					winston.format.printf(({ level, message, timestamp, source }) => {
						return stripAnsi(`${timestamp} ${level} ${source} ${message} `)
					})
				),
			})

			transport.on('rotate', (oldFilename, newFilename) => {
				this.logger.info(`Starting new log file: "${newFilename}"`)
			})
			this.winston.add(transport)

			this.logger.info('Logging started')
		}
	}
}

// Get this thing started right away!
// This shouldn't happen here, but some sequencing things with the imports means it does for now
const logger = new LogController()
global.logger = logger

export default logger

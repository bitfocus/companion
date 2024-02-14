/**
 * Warning: this file needs to not reference any 'real' code in the codebase, or we end up with import cycle issues
 */
import { cloneDeep } from 'lodash-es'
import stripAnsi from 'strip-ansi'
import fs from 'fs-extra'
import winston from 'winston'
import Transport from 'winston-transport'
import supportsColor from 'supports-color'
import consoleColors from './Colors.js'
import { init, configureScope, addBreadcrumb } from '@sentry/node'
import { RewriteFrames as RewriteFramesIntegration } from '@sentry/integrations'
import '@sentry/tracing'
import debounceFn from 'debounce-fn'

const SentrySeverity = {
	debug: 'debug',
	info: 'info',
	warn: 'warning',
	error: 'error',
}

class ToMemoryTransport extends Transport {
	/**
	 * @param {Transport.TransportStreamOptions | undefined} opts
	 * @param {(line: any) => void} addToHistory
	 */
	constructor(opts, addToHistory) {
		super(opts)

		this.addToHistory = addToHistory
	}

	/**
	 * @param {any} info
	 * @param {() => void} callback
	 */
	log(info, callback) {
		this.addToHistory(info)

		callback()
	}
}

const LogRoom = 'logs'

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
	 * @type {typeof addBreadcrumb | null}
	 * @access protected
	 */
	#addBreadcrumb = null
	/**
	 * The log array
	 * @type {import('../Shared/Model/LogLine.js').ClientLogLine[]}
	 * @access protected
	 */
	#history = []

	/**
	 * @type {import('../UI/Handler.js').default | null}
	 */
	#ioController = null

	/**
	 * Create a new logger
	 */
	constructor() {
		/**
		 * Select a colour for a log namespace
		 * @param {string} namespace
		 * @returns {number}
		 */
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
						// @ts-ignore
						format: winston.format.simple(),
					}),
				],
			})
		} else {
			const consoleFormat = [
				winston.format.timestamp(),
				winston.format.printf(({ level, message, timestamp, source }) => {
					const color = selectColor(source)
					const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)
					const prefix = `${colorCode};1m${source}\u001B[0m`

					return `${timestamp} ${level} ${prefix} ${message} `
				}),
			]
			if (supportsColor.stdout) consoleFormat.unshift(winston.format.colorize())

			this.winston = winston.createLogger({
				level: 'info',
				transports: [
					new winston.transports.Console({
						// @ts-ignore
						format: winston.format.combine(...consoleFormat),
					}),
					new ToMemoryTransport(
						{
							level: 'debug',
							format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
						},
						this.#addToHistory.bind(this)
					),
				],
			})
		}

		this.logger = this.createLogger('Log/Controller')
	}

	/**
	 * Set the log level to output
	 * @param {string} level
	 */
	setLogLevel(level) {
		this.winston.level = level
	}

	/**
	 * Create a child logger
	 * @param {string} source
	 * @returns {winston.Logger}
	 */
	createLogger(source) {
		return this.winston.child({ source })
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('logs:subscribe', () => {
			client.join(LogRoom)

			return this.#history
		})
		client.onPromise('logs:unsubscribe', () => {
			client.leave(LogRoom)
		})
		client.onPromise('logs:clear', () => {
			this.#history = []

			if (this.#ioController && this.#ioController.countRoomMembers(LogRoom) > 0) {
				this.#ioController.emitToRoom(LogRoom, 'logs:clear')

				this.#ioController.emitToRoom(LogRoom, 'logs:lines', [
					{
						time: Date.now(),
						source: 'log',
						level: 'info',
						message: 'Log cleared',
					},
				])
			}
		})
	}

	/** @type {import('../Shared/Model/LogLine.js').ClientLogLine[]} */
	#pendingLines = []
	debounceSendLines = debounceFn(
		() => {
			if (this.#ioController && this.#ioController.countRoomMembers(LogRoom) > 0) {
				this.#ioController.emitToRoom(LogRoom, 'logs:lines', this.#pendingLines)
			}
			this.#pendingLines = []
		},
		{
			maxWait: 250,
			wait: 50,
			after: true,
		}
	)

	/**
	 * Add a line logged to winston to the log history
	 * @param {any} line
	 * @access private
	 */
	#addToHistory(line) {
		/** @type {import('../Shared/Model/LogLine.js').ClientLogLine} */
		const uiLine = {
			time: line.timestamp,
			source: stripAnsi(line.source),
			level: line.level,
			message: stripAnsi(line.message),
		}

		this.#pendingLines.push(uiLine)
		this.debounceSendLines()

		this.#history.push(uiLine)
		if (this.#history.length > 5000) {
			this.#history.shift()
		}

		if (typeof this.#addBreadcrumb === 'function') {
			this.#addBreadcrumb({
				category: 'source',
				// @ts-ignore
				level: SentrySeverity[line.level] || SentrySeverity.debug,
				message: `${line.source}: ${line.message}`,
			})
		}
	}

	/**
	 * Get all of the log entries
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a reference
	 * @return {import('../Shared/Model/LogLine.js').ClientLogLine[]} the log entries
	 * @access public
	 */
	getAllLines(clone = false) {
		this.logger.silly(`get all`)

		if (clone) {
			return cloneDeep(this.#history)
		} else {
			return this.#history
		}
	}

	/**
	 * Initialize Sentry and UI logging
	 * @param {import('../Registry.js').AppInfo } appInfo
	 * @param {import('../UI/Handler.js').default} ioController
	 * @returns {void}
	 * @access public
	 */
	init(appInfo, ioController) {
		this.#ioController = ioController

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
					release: `companion@${appInfo.appBuild || appInfo.appVersion}`,
					beforeSend(event) {
						if (event.exception) {
							console.log('sentry', 'error', JSON.stringify(event.exception, undefined, 4))
						}
						return event
					},
					integrations: [new RewriteFramesIntegration()],
				})

				configureScope((scope) => {
					scope.setUser({ id: appInfo.machineId })
					scope.setExtra('build', appInfo.appBuild)
				})
			} catch (e) {
				this.logger.info(`Failed to setup sentry reporting: ${e}`)
			}

			this.#addBreadcrumb = addBreadcrumb
			this.logger.info(`Sentry error reporting configured`)
		} else {
			this.logger.info('Sentry error reporting is disabled')
		}
	}
}

// Get this thing started right away!
// This shouldn't happen here, but some sequencing things with the imports means it does for now
const logger = new LogController()
// @ts-ignore
global.logger = logger

export default logger

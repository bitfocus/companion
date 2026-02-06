/**
 * Warning: this file needs to not reference any 'real' code in the codebase, or we end up with import cycle issues
 */
import stripAnsi from 'strip-ansi'
import fs from 'fs-extra'
import winston, { type LeveledLogMethod, type LogMethod } from 'winston'
import Transport from 'winston-transport'
import { Syslog, type SyslogTransportOptions } from 'winston-syslog'
import supportsColor from 'supports-color'
import { LogColors } from './Colors.js'
import { init, addBreadcrumb, getCurrentScope, rewriteFramesIntegration } from '@sentry/node'
import debounceFn from 'debounce-fn'
import type { ClientLogLine, ClientLogUpdate } from '@companion-app/shared/Model/LogLine.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import EventEmitter from 'node:events'
import { isPackaged } from '../Resources/Util.js'

export interface Logger {
	readonly source: string

	child(options: { source: string }): Logger

	log: LogMethod
	error: LeveledLogMethod
	warn: LeveledLogMethod
	info: LeveledLogMethod
	debug: LeveledLogMethod
	verbose: LeveledLogMethod
	silly: LeveledLogMethod

	isDebugEnabled(): boolean
	isSillyEnabled(): boolean
}

const SentrySeverity = {
	debug: 'debug',
	info: 'info',
	warn: 'warning',
	error: 'error',
}

type LogLineFn = (line: any) => void
class ToMemoryTransport extends Transport {
	readonly #addToHistory: LogLineFn

	constructor(opts: Transport.TransportStreamOptions | undefined, addToHistory: LogLineFn) {
		super(opts)

		this.#addToHistory = addToHistory
	}

	log(info: any, callback: () => void) {
		this.#addToHistory(info)

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
 */
class LogController {
	/**
	 * The Sentry <code>addBreadcrumb</code> function, if initialized
	 */
	#addBreadcrumb: typeof addBreadcrumb | null = null

	#history: ClientLogLine[] = []

	#winston: winston.Logger
	#logger: Logger

	readonly #events = new EventEmitter<{ update: [ClientLogUpdate] }>()

	/**
	 * Create a new logger
	 */
	constructor() {
		this.#events.setMaxListeners(0)

		/**
		 * Select a colour for a log namespace
		 */
		function selectColor(namespace: string): number {
			let hash = 0

			for (let i = 0; i < namespace.length; i++) {
				hash = (hash << 5) - hash + namespace.charCodeAt(i)
				hash |= 0 // Convert to 32bit integer
			}

			return LogColors[Math.abs(hash) % LogColors.length]
		}

		if (process.env.VITEST_WORKER_ID) {
			// Use a simpler log setup in tests
			this.#winston = winston.createLogger({
				level: 'silly',
				transports: [
					new winston.transports.Console({
						format: winston.format.simple(),
					}),
				],
			})
		} else {
			const consoleFormat = [
				winston.format.timestamp(),
				winston.format.printf(({ level, message, timestamp, source }) => {
					const color = selectColor(String(source))
					const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)
					const prefix = `${colorCode};1m${source}\u001B[0m`

					return `${timestamp} ${level} ${prefix} ${message} `
				}),
			]
			if (supportsColor.stdout) consoleFormat.unshift(winston.format.colorize())

			this.#winston = winston.createLogger({
				level: 'info',
				transports: [
					new winston.transports.Console({
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

		this.#logger = this.createLogger('Log/Controller')
	}

	/**
	 * Get the log level
	 */
	getLogLevel(): string {
		return this.#winston.level
	}

	/**
	 * Set the log level to output
	 */
	setLogLevel(level: string): void {
		this.#winston.level = level
	}

	/**
	 * Create a child logger
	 */
	createLogger(source: string): Logger {
		const winstonLogger = this.#winston.child({ source })

		return {
			source,

			child: (options: { source: string }) => {
				return this.createLogger(`${source}/${options.source}`)
			},

			log: winstonLogger.log.bind(winstonLogger),

			error: winstonLogger.error.bind(winstonLogger),
			warn: winstonLogger.warn.bind(winstonLogger),
			info: winstonLogger.info.bind(winstonLogger),
			debug: winstonLogger.debug.bind(winstonLogger),
			verbose: winstonLogger.verbose.bind(winstonLogger),
			silly: winstonLogger.silly.bind(winstonLogger),

			isDebugEnabled: () => winstonLogger.isDebugEnabled(),
			isSillyEnabled: () => winstonLogger.isSillyEnabled(),
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'update', signal)

				yield { type: 'lines', lines: self.#history } satisfies ClientLogUpdate

				for await (const [change] of changes) {
					yield change
				}
			}),

			clear: publicProcedure.mutation(() => {
				this.#history = []

				if (this.#events.listenerCount('update') > 0) {
					this.#events.emit('update', { type: 'clear' })
					this.#events.emit('update', {
						type: 'lines',
						lines: [
							{
								time: Date.now(),
								source: 'log',
								level: 'info',
								message: 'Log cleared',
							},
						],
					})
				}
			}),
		})
	}

	#pendingLines: ClientLogLine[] = []
	debounceSendLines = debounceFn(
		() => {
			if (this.#events.listenerCount('update') > 0) {
				this.#events.emit('update', {
					type: 'lines',
					lines: this.#pendingLines,
				})
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
	 */
	#addToHistory(line: any) {
		const uiLine: ClientLogLine = {
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
				// @ts-expect-error Can't use string as index
				level: SentrySeverity[line.level] || SentrySeverity.debug,
				message: `${line.source}: ${line.message}`,
			})
		}
	}

	/**
	 * Get all of the log entries
	 * @param clone - <code>true</code> if a clone is needed instead of a reference
	 * @return the log entries
	 * @access public
	 */
	getAllLines(clone = false): ClientLogLine[] {
		this.#logger.silly(`get all`)

		if (clone) {
			return structuredClone(this.#history)
		} else {
			return this.#history
		}
	}

	/**
	 * Initialize send messages to syslog host
	 */

	addSyslogHost(options: SyslogTransportOptions): void {
		try {
			options.app_name = 'Companion'
			this.#winston.add(new Syslog(options))
			this.#logger.debug(`Syslog transport initialized. Options: ${JSON.stringify(options)}`)
		} catch (e) {
			this.#logger.error(`Failed to initialise syslog transport ${e}`)
		}
	}

	/**
	 * Initialize Sentry and UI logging
	 */
	init(appInfo: AppInfo): void {
		// Check if Sentry is explicitly disabled
		if (process.env.SENTRY_DISABLE) {
			this.#logger.info('Sentry error reporting is disabled (SENTRY_DISABLE env var set)')
			return
		}

		// Allow the DSN to be provided as an env variable
		let sentryDsn = process.env.SENTRY_DSN
		if (!sentryDsn) {
			try {
				sentryDsn = fs
					.readFileSync(new URL(isPackaged() ? './SENTRY' : '../../../SENTRY', import.meta.url))
					.toString()
					.trim()
			} catch (_e) {
				this.#logger.info('Sentry DSN not located')
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
					integrations: [rewriteFramesIntegration()],
				})

				const scope = getCurrentScope()
				scope.setUser({ id: appInfo.machineId })
				scope.setExtra('build', appInfo.appBuild)
			} catch (e) {
				this.#logger.info(`Failed to setup sentry reporting: ${e}`)
			}

			this.#addBreadcrumb = addBreadcrumb
			this.#logger.info(`Sentry error reporting configured`)
		} else {
			this.#logger.info('Sentry error reporting is disabled')
		}
	}
}

// Get this thing started right away!
// This shouldn't happen here, but some sequencing things with the imports means it does for now
const logger = new LogController()

export default logger

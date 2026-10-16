/**
 * Warning: this file needs to not reference any 'real' code in the codebase, or we end up with import cycle issues
 */
import EventEmitter from 'node:events'
import { configureSync, getLogger, withFilter, type LogRecord, type Sink } from '@logtape/logtape'
import { getSyslogSink, type SyslogSinkOptions } from '@logtape/syslog'
import { addBreadcrumb, getCurrentScope, httpIntegration, init, rewriteFramesIntegration } from '@sentry/node'
import debounceFn from 'debounce-fn'
import fs from 'fs-extra'
import stripAnsi from 'strip-ansi'
import supportsColor from 'supports-color'
import { LOG_LEVELS, type LogLevel } from '@companion-app/shared/LaunchOptions.js'
import type { ClientLogLine, ClientLogUpdate } from '@companion-app/shared/Model/LogLine.js'
import type { AppInfo } from '../Registry.js'
import { isPackaged } from '../Resources/Util.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import {
	formatConsoleLine,
	formatLogMessage,
	formatTestLine,
	fromLogTapeLevel,
	getRecordMessage,
	getRecordSource,
	toLogTapeLevel,
} from './Format.js'

export type LeveledLogMethod = (message: unknown, ...args: unknown[]) => void

export interface Logger {
	readonly source: string

	child(options: { source: string }): Logger

	log(level: LogLevel, message: string): void
	error: LeveledLogMethod
	warn: LeveledLogMethod
	info: LeveledLogMethod
	debug: LeveledLogMethod
	silly: LeveledLogMethod

	isDebugEnabled(): boolean
	isSillyEnabled(): boolean
}

const SYSLOG_MAX_BUFFERED_BYTES = 1024 * 1024

const SentrySeverity = {
	debug: 'debug',
	info: 'info',
	warn: 'warning',
	error: 'error',
}

/**
 * Coerce a logged value to a string. Loggers accept `any`, and values from modules are not validated
 */
export function stringifyLogValue(value: unknown): string {
	if (typeof value === 'string') return value
	if (value === undefined || value === null) return ''
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value)
		} catch (_e) {
			// Fall through
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(value)
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

	readonly #logTape = getLogger(['companion'])
	#level: LogLevel
	/** Index of the current level in LOG_LEVELS, or -1 when logging is suppressed */
	#levelIndex: number
	#syslogSink: Sink | null = null
	#logger: Logger

	readonly #events = new EventEmitter<{ update: [ClientLogUpdate] }>()

	/**
	 * Create a new logger
	 */
	constructor() {
		this.#events.setMaxListeners(0)

		let sinks: Record<'console' | 'memory' | 'syslog', Sink>
		if (process.env.VITEST_WORKER_ID) {
			// Use a simpler log setup in tests, and suppress all logging by default to keep test output readable.
			// Enable logging for a whole run with e.g. `COMPANION_TEST_LOG_LEVEL=debug yarn test`,
			// or within a single test with `LogController.setLogLevel('debug')`.
			const testLogLevel = process.env.COMPANION_TEST_LOG_LEVEL
			this.#level = (testLogLevel as LogLevel) || 'silly'
			this.#levelIndex = testLogLevel ? LOG_LEVELS.indexOf(this.#level) : -1

			sinks = {
				console: (record) => process.stdout.write(formatTestLine(record)),
				memory: () => {},
				syslog: () => {},
			}
		} else {
			this.#level = 'info'
			this.#levelIndex = LOG_LEVELS.indexOf(this.#level)

			const useColor = !!supportsColor.stdout
			sinks = {
				console: (record) => process.stdout.write(formatConsoleLine(record, useColor)),
				// The UI log never shows silly lines
				memory: withFilter((record) => this.#addToHistory(record), 'debug'),
				syslog: (record) => {
					if (!this.#syslogSink) return
					// Syslog has no field for the source, so include it in the message
					const message = `${getRecordSource(record)}: ${getRecordMessage(record)}`
					this.#syslogSink({ ...record, message: [message], rawMessage: message })
				},
			}
		}

		configureSync({
			// LogTape is global, and can outlive this module (eg between test files)
			reset: true,
			sinks,
			loggers: [
				{ category: ['companion'], lowestLevel: 'trace', sinks: ['console', 'memory', 'syslog'] },
				// Report problems with logging itself (such as being unable to reach the syslog server)
				{ category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console', 'memory'] },
			],
		})

		this.#logger = this.createLogger('Log/Controller')
	}

	/**
	 * Get the log level
	 */
	getLogLevel(): LogLevel {
		return this.#level
	}

	/**
	 * Set the log level to output
	 */
	setLogLevel(level: LogLevel): void {
		this.#level = level
		// Re-enables logging if it was suppressed (the default in tests)
		this.#levelIndex = LOG_LEVELS.indexOf(level)
	}

	#isLevelEnabled(level: LogLevel): boolean {
		return LOG_LEVELS.indexOf(level) <= this.#levelIndex
	}

	#emit(source: string, level: LogLevel, message: string): void {
		this.#logTape.emit({
			level: toLogTapeLevel(level),
			timestamp: Date.now(),
			// Pass the message as a single value, so that LogTape doesn't try to interpret any placeholders in it
			message: [message],
			rawMessage: message,
			properties: { source },
		})
	}

	/**
	 * Create a child logger
	 */
	createLogger(source: string): Logger {
		const leveledLogMethod =
			(level: LogLevel): LeveledLogMethod =>
			(message, ...args) => {
				if (this.#isLevelEnabled(level)) this.#emit(source, level, formatLogMessage(message, args))
			}

		return {
			source,

			child: (options: { source: string }) => {
				return this.createLogger(`${source}/${options.source}`)
			},

			log: (level, message) => {
				if (this.#isLevelEnabled(level)) this.#emit(source, level, message)
			},

			error: leveledLogMethod('error'),
			warn: leveledLogMethod('warn'),
			info: leveledLogMethod('info'),
			debug: leveledLogMethod('debug'),
			silly: leveledLogMethod('silly'),

			isDebugEnabled: () => this.#isLevelEnabled('debug'),
			isSillyEnabled: () => this.#isLevelEnabled('silly'),
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
	 * Add a logged line to the log history
	 */
	#addToHistory(record: LogRecord) {
		const level = fromLogTapeLevel(record.level)
		const source = getRecordSource(record)
		const message = getRecordMessage(record)

		const uiLine: ClientLogLine = {
			time: record.timestamp,
			source: stripAnsi(source),
			level,
			message: stripAnsi(message),
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
				level: SentrySeverity[level] || SentrySeverity.debug,
				message: `${source}: ${message}`,
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
	addSyslogHost(options: SyslogSinkOptions): void {
		try {
			this.#syslogSink = getSyslogSink({
				...options,
				appName: 'Companion',
				// Drop log lines rather than buffering without limit, if the server is slow or unreachable
				maxBufferedBytes: SYSLOG_MAX_BUFFERED_BYTES,
			})
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

		if (sentryDsn && sentryDsn.startsWith('https://')) {
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
					integrations: [
						rewriteFramesIntegration(),
						httpIntegration({
							sessions: false,
						}),
					],
					// Disable periodic client reports - we only care about actual errors
					sendClientReports: false,
					// Keep the v10 privacy defaults: no auto user info, cookies or http bodies
					dataCollection: {
						userInfo: false,
						cookies: false,
						httpBodies: [],
					},
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

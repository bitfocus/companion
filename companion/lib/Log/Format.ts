/**
 * Pure helpers for the logger. Like Controller.ts, this needs to not reference any 'real' code in the codebase.
 */
import util from 'node:util'
import type { LogRecord, LogLevel as LogTapeLevel } from '@logtape/logtape'
import type { LogLevel } from '@companion-app/shared/LaunchOptions.js'
import { LogColors } from './Colors.js'

const LogTapeLevels: Record<LogLevel, LogTapeLevel> = {
	error: 'error',
	warn: 'warning',
	info: 'info',
	debug: 'debug',
	silly: 'trace',
}

const CompanionLevels: Record<LogTapeLevel, LogLevel> = {
	fatal: 'error',
	error: 'error',
	warning: 'warn',
	info: 'info',
	debug: 'debug',
	trace: 'silly',
}

// The ansi colours used for each level, matching what winston used to use
const LevelColors: Record<LogLevel, number> = {
	error: 31, // red
	warn: 33, // yellow
	info: 32, // green
	debug: 34, // blue
	silly: 35, // magenta
}

export function toLogTapeLevel(level: LogLevel): LogTapeLevel {
	return LogTapeLevels[level]
}

export function fromLogTapeLevel(level: LogTapeLevel): LogLevel {
	return CompanionLevels[level]
}

/**
 * Combine a log message with any extra arguments passed to the log method
 */
export function formatLogMessage(message: unknown, args: unknown[]): string {
	let result = typeof message === 'string' ? message : formatLogArgument(message)
	for (const arg of args) {
		result += ' ' + formatLogArgument(arg)
	}
	return result
}

function formatLogArgument(arg: unknown): string {
	if (typeof arg === 'string') return arg
	if (arg instanceof Error) return arg.message
	return util.inspect(arg, { depth: 4, breakLength: Infinity })
}

/**
 * Get the text of a log record.
 * The message alternates between text and values, values are only present in records from LogTape itself
 */
export function getRecordMessage(record: LogRecord): string {
	let result = ''
	for (let i = 0; i < record.message.length; i++) {
		const part = record.message[i]
		result += i % 2 === 0 ? String(part) : formatLogArgument(part)
	}
	return result
}

/**
 * Get the source of a log record, falling back to the category for records from LogTape itself
 */
export function getRecordSource(record: LogRecord): string {
	const source = record.properties.source
	return typeof source === 'string' ? source : record.category.join('/')
}

/**
 * Select a color for a log namespace
 */
export function selectColor(namespace: string): number {
	let hash = 0

	for (let i = 0; i < namespace.length; i++) {
		hash = (hash << 5) - hash + namespace.charCodeAt(i)
		hash |= 0 // Convert to 32bit integer
	}

	return LogColors[Math.abs(hash) % LogColors.length]
}

/**
 * Format a log record for writing to the console
 */
export function formatConsoleLine(record: LogRecord, useColor: boolean): string {
	const timestamp = new Date(record.timestamp).toISOString()
	const source = getRecordSource(record)

	let level: string = fromLogTapeLevel(record.level)
	if (useColor) level = `\u001B[${LevelColors[fromLogTapeLevel(record.level)]}m${level}\u001B[39m`

	const color = selectColor(source)
	const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)
	const prefix = `${colorCode};1m${source}\u001B[0m`

	return `${timestamp} ${level} ${prefix} ${getRecordMessage(record)} \n`
}

/**
 * Format a log record for writing to the console in tests
 */
export function formatTestLine(record: LogRecord): string {
	return `${fromLogTapeLevel(record.level)}: [${getRecordSource(record)}] ${getRecordMessage(record)}\n`
}

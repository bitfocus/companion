import type { LogRecord } from '@logtape/logtape'
import { describe, expect, test } from 'vitest'
import {
	formatConsoleLine,
	formatLogMessage,
	formatTestLine,
	fromLogTapeLevel,
	getRecordMessage,
	getRecordSource,
	selectColor,
	toLogTapeLevel,
} from '../../lib/Log/Format.js'

function makeRecord(level: LogRecord['level'], message: string, source: string): LogRecord {
	return {
		category: ['companion'],
		level,
		message: [message],
		rawMessage: message,
		timestamp: Date.UTC(2026, 0, 2, 3, 4, 5, 678),
		properties: { source },
	}
}

describe('log levels', () => {
	test('round trip through LogTape levels', () => {
		for (const level of ['error', 'warn', 'info', 'debug', 'silly'] as const) {
			expect(fromLogTapeLevel(toLogTapeLevel(level))).toBe(level)
		}
	})

	test('map onto the LogTape names', () => {
		expect(toLogTapeLevel('warn')).toBe('warning')
		expect(toLogTapeLevel('silly')).toBe('trace')
		expect(fromLogTapeLevel('fatal')).toBe('error')
	})
})

describe('formatLogMessage', () => {
	test('returns a plain message unchanged', () => {
		expect(formatLogMessage('hello {world}', [])).toBe('hello {world}')
	})

	test('appends an error message', () => {
		expect(formatLogMessage('Failed to save:', [new Error('disk full')])).toBe('Failed to save: disk full')
	})

	test('appends strings and inspected values', () => {
		expect(formatLogMessage('a', ['b', 3, { c: [1, 2] }])).toBe('a b 3 { c: [ 1, 2 ] }')
	})

	test('formats a non-string message', () => {
		expect(formatLogMessage({ a: 1 }, [])).toBe('{ a: 1 }')
		expect(formatLogMessage(new Error('boom'), [])).toBe('boom')
	})
})

describe('records from LogTape itself', () => {
	const record: LogRecord = {
		category: ['logtape', 'meta', 'syslog'],
		level: 'error',
		message: ['Failed to send: ', new Error('ECONNREFUSED'), ''],
		rawMessage: 'Failed to send: {error}',
		timestamp: 0,
		properties: { error: new Error('ECONNREFUSED') },
	}

	test('interpolate the message values', () => {
		expect(getRecordMessage(record)).toBe('Failed to send: ECONNREFUSED')
	})

	test('use the category as the source', () => {
		expect(getRecordSource(record)).toBe('logtape/meta/syslog')
	})
})

describe('formatConsoleLine', () => {
	test('without color', () => {
		const color = selectColor('Some/Source')
		const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)

		expect(formatConsoleLine(makeRecord('warning', 'a message', 'Some/Source'), false)).toBe(
			`2026-01-02T03:04:05.678Z warn ${colorCode};1mSome/Source\u001B[0m a message \n`
		)
	})

	test('with color', () => {
		const line = formatConsoleLine(makeRecord('error', 'oh no', 'Src'), true)
		expect(line.startsWith('2026-01-02T03:04:05.678Z \u001B[31merror\u001B[39m ')).toBe(true)
		expect(line.endsWith('Src\u001B[0m oh no \n')).toBe(true)
	})
})

describe('formatTestLine', () => {
	test('formats a simple line', () => {
		expect(formatTestLine(makeRecord('trace', 'detail', 'Src'))).toBe('silly: [Src] detail\n')
	})
})

describe('selectColor', () => {
	test('is stable for a namespace', () => {
		expect(selectColor('abc')).toBe(selectColor('abc'))
	})
})

import { describe, expect, test } from 'vitest'
import winston from 'winston'
import Transport from 'winston-transport'
import type { ClientLogLine } from '@companion-app/shared/Model/LogLine.js'
import { stringifyLogValue, ToMemoryTransport } from '../../lib/Log/Controller.js'

class CountingTransport extends Transport {
	count = 0

	log(_info: any, callback: () => void) {
		this.count++
		callback()
	}
}

function createTestLogger(addToHistory: (line: ClientLogLine) => void) {
	const counter = new CountingTransport()
	const memory = new ToMemoryTransport(
		{ format: winston.format.combine(winston.format.timestamp(), winston.format.json()) },
		addToHistory
	)
	const logger = winston.createLogger({ level: 'info', transports: [counter, memory] }).child({ source: 'Test' })

	return { counter, logger }
}

describe('stringifyLogValue', () => {
	test('strings are unchanged', () => {
		expect(stringifyLogValue('abc')).toBe('abc')
	})

	test('undefined and null', () => {
		expect(stringifyLogValue(undefined)).toBe('')
		expect(stringifyLogValue(null)).toBe('')
	})

	test('numbers and objects', () => {
		expect(stringifyLogValue(42)).toBe('42')
		expect(stringifyLogValue({ a: 1 })).toBe('{"a":1}')
	})

	test('unserializable objects', () => {
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		expect(stringifyLogValue(cyclic)).toBe('[object Object]')
		expect(stringifyLogValue(10n)).toBe('10')
	})
})

describe('ToMemoryTransport', () => {
	test('non-string messages are stringified', () => {
		const lines: ClientLogLine[] = []
		const { logger } = createTestLogger((line) => lines.push(line))

		logger.info(undefined as any)
		logger.info(42 as any)
		logger.info({ a: 1 } as any)

		expect(lines.map((l) => [l.source, l.message])).toEqual([
			['Test', ''],
			['Test', '42'],
			['Test', '{"a":1}'],
		])
	})

	test('logging continues after a bad message #4509', async () => {
		const lines: ClientLogLine[] = []
		const { counter, logger } = createTestLogger((line) => lines.push(line))

		logger.info({ some: 'object' } as any)
		for (let i = 0; i < 100; i++) logger.info(`line ${i}`)

		await new Promise((resolve) => setImmediate(resolve))

		expect(counter.count).toBe(101)
		expect(lines).toHaveLength(101)
	})

	test('logging continues when the history sink throws', async () => {
		const { counter, logger } = createTestLogger(() => {
			throw new Error('boom')
		})

		for (let i = 0; i < 100; i++) logger.info(`line ${i}`)

		await new Promise((resolve) => setImmediate(resolve))

		expect(counter.count).toBe(100)
	})
})

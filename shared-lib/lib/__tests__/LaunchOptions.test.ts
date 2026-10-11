import { describe, expect, test } from 'vitest'
import { LAUNCH_OPTIONS, parseLogLevel } from '../LaunchOptions.js'

describe('parseLogLevel', () => {
	test('accepts the current levels', () => {
		expect(parseLogLevel('error')).toBe('error')
		expect(parseLogLevel('warn')).toBe('warn')
		expect(parseLogLevel('info')).toBe('info')
		expect(parseLogLevel('debug')).toBe('debug')
		expect(parseLogLevel('silly')).toBe('silly')
	})

	test('maps the retired levels onto their replacement', () => {
		expect(parseLogLevel('http')).toBe('info')
		expect(parseLogLevel('verbose')).toBe('debug')
	})

	test('rejects unknown levels', () => {
		expect(parseLogLevel('trace')).toBeNull()
		expect(parseLogLevel('')).toBeNull()
		expect(parseLogLevel('toString')).toBeNull()
	})

	test('the logLevel launch option accepts the retired levels as aliases', () => {
		const option = LAUNCH_OPTIONS.find((o) => o.key === 'logLevel')
		expect(option?.enumAliases).toEqual({ http: 'info', verbose: 'debug' })
	})
})

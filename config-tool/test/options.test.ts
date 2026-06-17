import { describe, expect, it } from 'vitest'
import type { LaunchOption } from '@companion-app/shared/LaunchOptions.js'
import { coerceValue, optionFileDefault, resolveValue, validateValue } from '../lib/options.js'

const numberOpt: LaunchOption = {
	key: 'adminPort',
	type: 'number',
	default: 8000,
	short: '',
	cliFlag: '--admin-port <number>',
	validate: (v) => (Number(v) > 65535 ? 'Must be a port number between 1 and 65535' : undefined),
}
const boolOpt: LaunchOption = { key: 'syslogTcp', type: 'boolean', default: false, short: '', cliFlag: '--syslog-tcp' }
const enumOpt: LaunchOption = {
	key: 'logLevel',
	type: 'enum',
	enumValues: ['info', 'debug'],
	short: '',
	cliFlag: '--log-level <string>',
}
const stringOpt: LaunchOption = { key: 'configDir', type: 'string', short: '', cliFlag: '--config-dir <string>' }

describe('coerceValue', () => {
	it('treats empty/null as unset', () => {
		expect(coerceValue(stringOpt, '')).toEqual({ value: null })
		expect(coerceValue(stringOpt, null)).toEqual({ value: null })
		expect(coerceValue(stringOpt, undefined)).toEqual({ value: null })
	})

	it('parses booleans from common strings', () => {
		expect(coerceValue(boolOpt, 'true').value).toBe(true)
		expect(coerceValue(boolOpt, 'no').value).toBe(false)
		expect(coerceValue(boolOpt, true).value).toBe(true)
		expect(coerceValue(boolOpt, 'maybe').error).toBeDefined()
	})

	it('parses and rejects numbers', () => {
		expect(coerceValue(numberOpt, '9000').value).toBe(9000)
		expect(coerceValue(numberOpt, 'abc').error).toBeDefined()
	})

	it('validates enum membership', () => {
		expect(coerceValue(enumOpt, 'debug').value).toBe('debug')
		expect(coerceValue(enumOpt, 'silly').error).toBeDefined()
	})
})

describe('validateValue', () => {
	it('runs the option validator and skips null', () => {
		expect(validateValue(numberOpt, 70000)).toBeDefined()
		expect(validateValue(numberOpt, 8000)).toBeUndefined()
		expect(validateValue(numberOpt, null)).toBeUndefined()
	})
})

describe('resolveValue', () => {
	it('uses the file value when set, otherwise the default', () => {
		expect(resolveValue(numberOpt, 9000)).toBe(9000)
		expect(resolveValue(numberOpt, null)).toBe(8000)
		expect(resolveValue(stringOpt, undefined)).toBe(null)
	})

	it('throws on an invalid file value', () => {
		expect(() => resolveValue(numberOpt, 'nope')).toThrow()
	})
})

describe('optionFileDefault', () => {
	it('is the declared default, or null when unset', () => {
		expect(optionFileDefault(numberOpt)).toBe(8000)
		expect(optionFileDefault(boolOpt)).toBe(false)
		expect(optionFileDefault(stringOpt)).toBe(null)
	})
})

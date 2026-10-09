import { describe, expect, test } from 'vitest'
import { formatSatelliteMessage, parseSatelliteBitmapFormat } from '../codec.js'

describe('formatSatelliteMessage', () => {
	test('terminates the message with a space and newline', () => {
		expect(formatSatelliteMessage('PING', null, null, {})).toBe('PING \n')
	})

	test('includes the status and quoted device id', () => {
		expect(formatSatelliteMessage('ADD-DEVICE', 'ERROR', 'dev 1', { MESSAGE: 'Bad' })).toBe(
			'ADD-DEVICE ERROR DEVICEID="dev 1" MESSAGE="Bad" \n'
		)
	})

	test('omits an empty device id', () => {
		expect(formatSatelliteMessage('X', null, '', {})).toBe('X \n')
	})

	test('sends booleans as 1/0 and numbers bare', () => {
		expect(formatSatelliteMessage('X', null, null, { A: true, B: false, C: -2, D: 1.5 })).toBe(
			'X A=1 B=0 C=-2 D=1.5 \n'
		)
	})

	test('escapes backslashes and quotes in string values', () => {
		expect(formatSatelliteMessage('X', null, 'a\\"b', { V: '"\\' })).toBe('X DEVICEID="a\\\\\\"b" V="\\"\\\\" \n')
	})
})

describe('parseSatelliteBitmapFormat', () => {
	test('accepts the known formats', () => {
		expect(parseSatelliteBitmapFormat('rgb')).toBe('rgb')
		expect(parseSatelliteBitmapFormat('png')).toBe('png')
		expect(parseSatelliteBitmapFormat('webp')).toBe('webp')
	})

	test('falls back to rgb for missing or unknown values', () => {
		expect(parseSatelliteBitmapFormat(undefined)).toBe('rgb')
		expect(parseSatelliteBitmapFormat(true)).toBe('rgb')
		expect(parseSatelliteBitmapFormat('jpeg')).toBe('rgb')
	})
})

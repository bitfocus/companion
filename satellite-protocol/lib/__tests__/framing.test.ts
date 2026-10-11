import { describe, expect, test } from 'vitest'
import { SatelliteLineBuffer, splitSatelliteCommand } from '../codec.js'

describe('splitSatelliteCommand', () => {
	test('splits at the first space', () => {
		expect(splitSatelliteCommand('KEY-PRESS DEVICEID="a b" KEY=1')).toEqual({
			command: 'KEY-PRESS',
			body: 'DEVICEID="a b" KEY=1',
		})
	})

	test('a command without parameters has an empty body', () => {
		expect(splitSatelliteCommand('PING')).toEqual({ command: 'PING', body: '' })
	})

	test('keeps the command as received', () => {
		expect(splitSatelliteCommand('ping 1').command).toBe('ping')
	})
})

describe('SatelliteLineBuffer', () => {
	test('returns complete lines and holds an incomplete one', () => {
		const buffer = new SatelliteLineBuffer(100)
		expect(buffer.push('PING 1\nPING')).toEqual({ lines: ['PING 1'], overflow: false })
		expect(buffer.push(' 2\n')).toEqual({ lines: ['PING 2'], overflow: false })
		expect(buffer.push('')).toEqual({ lines: [], overflow: false })
	})

	test('handles many lines in one chunk, including empty ones', () => {
		const buffer = new SatelliteLineBuffer(100)
		expect(buffer.push('A\n\nB\n').lines).toEqual(['A', '', 'B'])
	})

	test('strips only a trailing carriage return', () => {
		const buffer = new SatelliteLineBuffer(100)
		expect(buffer.push('A\r\nB\rC\r\n').lines).toEqual(['A', 'B\rC'])
	})

	test('a carriage return split from its newline is still stripped', () => {
		const buffer = new SatelliteLineBuffer(100)
		expect(buffer.push('A\r').lines).toEqual([])
		expect(buffer.push('\n').lines).toEqual(['A'])
	})

	test('reports overflow once an incomplete line exceeds the limit, and discards it', () => {
		const buffer = new SatelliteLineBuffer(5)
		expect(buffer.push('OK\n12345')).toEqual({ lines: ['OK'], overflow: false })
		expect(buffer.push('6')).toEqual({ lines: [], overflow: true })
		expect(buffer.push('X\n')).toEqual({ lines: ['X'], overflow: false })
	})

	test('a complete line longer than the limit is not an overflow', () => {
		const buffer = new SatelliteLineBuffer(5)
		expect(buffer.push('1234567890\n')).toEqual({ lines: ['1234567890'], overflow: false })
	})

	test('clear discards an incomplete line', () => {
		const buffer = new SatelliteLineBuffer(100)
		buffer.push('PARTIAL')
		buffer.clear()
		expect(buffer.push('A\n').lines).toEqual(['A'])
	})
})

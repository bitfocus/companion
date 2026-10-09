import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { formatSatelliteMessage, parseLineParameters, type SatelliteMessageArgs } from '../codec.js'

interface Corpus {
	version: number
	parse: { name: string; line: string; expected: Record<string, string | true> }[]
	format: {
		name: string
		message: string
		status: 'OK' | 'ERROR' | null
		deviceId: string | null
		args: SatelliteMessageArgs
		expected: string
	}[]
	roundTrip: string[]
}

const corpus: Corpus = JSON.parse(
	fs.readFileSync(new URL('../../assets/satellite-protocol-corpus.json', import.meta.url), 'utf8')
)

describe('satellite protocol corpus', () => {
	describe('parse', () => {
		test.each(corpus.parse.map((c) => [c.name, c] as const))('%s', (_name, c) => {
			expect({ ...parseLineParameters(c.line) }).toEqual(c.expected)
		})
	})

	describe('format', () => {
		test.each(corpus.format.map((c) => [c.name, c] as const))('%s', (_name, c) => {
			expect(formatSatelliteMessage(c.message, c.status, c.deviceId, c.args)).toBe(c.expected)
		})
	})

	describe('round trip', () => {
		test.each(corpus.roundTrip.map((v) => [JSON.stringify(v), v] as const))('%s', (_name, value) => {
			const line = formatSatelliteMessage('TEST', null, value || null, { VALUE: value })
			expect(line.endsWith('\n')).toBe(true)

			// Strip the command name and terminator, as a receiver does before parsing the parameters
			const body = line.slice('TEST '.length, -1)
			const params = parseLineParameters(body)
			expect(params.VALUE).toBe(value)
			if (value) expect(params.DEVICEID).toBe(value)
		})
	})
})

import { describe, expect, test } from 'vitest'
import {
	derivePairingCode,
	formatKeyFingerprint,
	normalisePairingCode,
} from '../../lib/Link/Transports/Direct/Pairing.js'

describe('pairing codes', () => {
	test('are 8 digits, derived deterministically from the handshake hash', () => {
		const hash = Buffer.alloc(64, 1)
		const code = derivePairingCode(hash)
		expect(code).toMatch(/^\d{4}-\d{4}$/)
		expect(derivePairingCode(Buffer.from(hash))).toBe(code)
		expect(derivePairingCode(Buffer.alloc(64, 2))).not.toBe(code)
	})

	test('ignore separators and spaces when entered', () => {
		expect(normalisePairingCode(' 1234 5678 ')).toBe('12345678')
		expect(normalisePairingCode('1234-5678')).toBe('12345678')
	})

	test('key fingerprints are short and readable', () => {
		expect(formatKeyFingerprint('abcdEF0123456789ffff')).toBe('abcd EF01 2345 6789')
	})
})

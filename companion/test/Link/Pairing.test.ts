import { describe, expect, test } from 'vitest'
import {
	commitPairingNonce,
	createPairingNonce,
	derivePairingCode,
	normalisePairingCode,
	parseAuthFrame,
} from '../../lib/Link/Transports/Secure/Pairing.js'

describe('pairing codes', () => {
	const accepting = createPairingNonce()
	const connecting = createPairingNonce()

	test('are 8 digits, derived deterministically from the handshake hash and both nonces', () => {
		const hash = Buffer.alloc(64, 1)
		const code = derivePairingCode(hash, accepting, connecting)
		expect(code).toMatch(/^\d{4}-\d{4}$/)
		expect(derivePairingCode(Buffer.from(hash), accepting, connecting)).toBe(code)

		expect(derivePairingCode(Buffer.alloc(64, 2), accepting, connecting)).not.toBe(code)
		expect(derivePairingCode(hash, createPairingNonce(), connecting)).not.toBe(code)
		expect(derivePairingCode(hash, accepting, createPairingNonce())).not.toBe(code)
		// Which end each nonce came from matters
		expect(derivePairingCode(hash, connecting, accepting)).not.toBe(code)
	})

	test('ignore separators and spaces when entered', () => {
		expect(normalisePairingCode(' 1234 5678 ')).toBe('12345678')
		expect(normalisePairingCode('1234-5678')).toBe('12345678')
	})
})

describe('pairing nonces', () => {
	test('are random, and committed to by a hash that matches only that nonce', () => {
		const nonce = createPairingNonce()
		expect(nonce).toMatch(/^[0-9a-f]{64}$/)
		expect(createPairingNonce()).not.toBe(nonce)

		const commit = commitPairingNonce(nonce)
		expect(commit).toMatch(/^[0-9a-f]{64}$/)
		expect(commit).not.toBe(nonce)
		expect(commitPairingNonce(nonce)).toBe(commit)
		expect(commitPairingNonce(createPairingNonce())).not.toBe(commit)
	})

	test('frames carrying them are parsed, and anything malformed is rejected', () => {
		const nonce = createPairingNonce()
		expect(parseAuthFrame(JSON.stringify({ op: 'pairing-nonce', nonce }))).toEqual({
			op: 'pairing-nonce',
			nonce,
		})
		expect(parseAuthFrame(JSON.stringify({ op: 'pairing-nonce', nonce: 'short' }))).toBeNull()
		expect(parseAuthFrame(JSON.stringify({ op: 'auth', status: 'pairing-required' }))).toBeNull()
		expect(parseAuthFrame('not json')).toBeNull()
	})
})

import { describe, expect, test } from 'vitest'
import { decodeLinkAnnouncement, encodeLinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { LINK_PROTOCOL_VERSIONS, negotiateLinkProtocolVersion } from '../../lib/Link/Protocol/Versions.js'

describe('message encoding', () => {
	test('round trips a message', () => {
		const payload = {
			id: 'press-1',
			expiresAt: 1_000,
			button: { type: 'location', page: 1, row: 2, column: 3 },
			pressed: true,
			surfaceId: 'surface',
		} as const
		const decoded = decodeLinkMessage(encodeLinkMessage('button.press', payload))
		expect(decoded).toEqual({ ok: true, message: { type: 'button.press', payload } })
	})

	test('rejects invalid json', () => {
		expect(decodeLinkMessage('{nope')).toEqual({ ok: false, error: 'Invalid JSON' })
	})

	test('has no version in the envelope, so a version field is ignored like any other unknown property', () => {
		const result = decodeLinkMessage(JSON.stringify({ version: 2, type: 'ping', payload: { nonce: 'n' } }))
		expect(result.ok).toBe(true)
	})

	test('rejects an unknown message type', () => {
		const result = decodeLinkMessage(JSON.stringify({ type: 'nonsense', payload: {} }))
		expect(result.ok).toBe(false)
	})

	test('rejects a payload that does not match the schema', () => {
		const result = decodeLinkMessage(
			JSON.stringify({
				type: 'button.press',
				payload: { button: { type: 'location', page: 'one', row: 0, column: 0 } },
			})
		)
		expect(result.ok).toBe(false)
	})

	test('ignores unknown properties, so that new optional fields are compatible', () => {
		const result = decodeLinkMessage(
			JSON.stringify({
				type: 'unsubscribe',
				payload: { buttons: [], somethingNew: 1 },
			})
		)
		expect(result.ok).toBe(true)
	})
})

describe('announcement', () => {
	const announcement = {
		name: 'Somewhere',
		companionVersion: '5.0.0',
		protocolVersions: ['1.0.0'],
		announceIntervalMs: 15_000,
	}

	test('round trips', () => {
		expect(decodeLinkAnnouncement(encodeLinkAnnouncement(announcement))).toEqual({ ok: true, announcement })
	})

	test('ignores unknown properties, so that new optional fields are readable by every version', () => {
		const result = decodeLinkAnnouncement(JSON.stringify({ ...announcement, somethingNew: 1 }))
		expect(result.ok).toBe(true)
	})

	test('rejects fields too long to be real, as they are stored and shown', () => {
		const decode = (fields: object) => decodeLinkAnnouncement(JSON.stringify({ ...announcement, ...fields })).ok
		expect(decode({ companionVersion: 'x'.repeat(65) })).toBe(false)
		expect(decode({ protocolVersions: ['1.0.0'.padEnd(33, '0')] })).toBe(false)
		expect(decode({ protocolVersions: Array.from({ length: 17 }, (_, i) => `${i + 1}.0.0`) })).toBe(false)
		expect(decode({ companionVersion: 'x'.repeat(64), protocolVersions: ['1.0.0', '2.0.0'] })).toBe(true)
	})
})

describe('versions', () => {
	test('speaks one version per major', () => {
		const majors = LINK_PROTOCOL_VERSIONS.map((v) => v.split('.')[0])
		expect(new Set(majors).size).toBe(majors.length)
		expect(negotiateLinkProtocolVersion(LINK_PROTOCOL_VERSIONS, LINK_PROTOCOL_VERSIONS)).not.toBeNull()
	})

	test('uses the highest major both speak, with the peer version of it', () => {
		expect(negotiateLinkProtocolVersion(['1.0.0'], ['1.99.0'])).toBe('1.99.0')
		expect(negotiateLinkProtocolVersion(['1.4.0', '2.0.0'], ['1.2.0'])).toBe('1.2.0')
		expect(negotiateLinkProtocolVersion(['1.4.0', '2.0.0'], ['1.5.0', '2.1.0'])).toBe('2.1.0')
		expect(negotiateLinkProtocolVersion(['2.0.0'], ['1.5.0', '2.1.0'])).toBe('2.1.0')
	})

	test('no shared major is incompatible', () => {
		expect(negotiateLinkProtocolVersion(['1.0.0'], ['2.0.0'])).toBeNull()
		expect(negotiateLinkProtocolVersion(['1.0.0'], ['0.9.0'])).toBeNull()
		expect(negotiateLinkProtocolVersion(['1.0.0'], ['garbage'])).toBeNull()
	})
})

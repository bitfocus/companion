import { describe, expect, test } from 'vitest'
import {
	decodeLinkAnnouncement,
	encodeLinkAnnouncement,
	linkDiscoveryTopic,
	parseLinkDiscoveryTopic,
} from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { linkButtonUpdateTopic, linkInboxTopic } from '../../lib/Link/Protocol/v1/Topics.js'
import { LINK_PROTOCOL_VERSIONS, negotiateLinkProtocolVersion } from '../../lib/Link/Protocol/Versions.js'

describe('message encoding', () => {
	test('round trips a message', () => {
		const payload = {
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

	test('rejects an unknown envelope version', () => {
		const result = decodeLinkMessage(JSON.stringify({ version: 2, type: 'button.press', payload: {} }))
		expect(result.ok).toBe(false)
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
})

describe('topics', () => {
	test('topics of a peer are under its id and the major version', () => {
		expect(linkInboxTopic('abc')).toBe('v1/peers/abc/inbox')
	})

	test('discovery topics round trip', () => {
		expect(parseLinkDiscoveryTopic(linkDiscoveryTopic('abc'))).toBe('abc')
	})

	test('other topics are not discovery topics', () => {
		expect(parseLinkDiscoveryTopic('abc/inbox')).toBeNull()
		expect(parseLinkDiscoveryTopic('discovery/abc/extra')).toBeNull()
		expect(parseLinkDiscoveryTopic('discovery/')).toBeNull()
	})

	test('button update topics are unique per location and size', () => {
		const a = linkButtonUpdateTopic('abc', {
			button: { type: 'location', page: 1, row: 0, column: 0 },
			width: 72,
			height: 72,
		})
		const b = linkButtonUpdateTopic('abc', {
			button: { type: 'location', page: 1, row: 0, column: 0 },
			width: 144,
			height: 144,
		})
		expect(a).not.toBe(b)
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

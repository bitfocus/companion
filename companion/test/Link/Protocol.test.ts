import { describe, expect, test } from 'vitest'
import { decodeLinkMessage, encodeLinkMessage } from '../../lib/Link/Protocol/Schemas.js'
import { linkButtonUpdateTopic, linkDiscoveryTopic, parseLinkDiscoveryTopic } from '../../lib/Link/Protocol/Topics.js'
import {
	getLinkPeerFeatures,
	isLinkProtocolCompatible,
	LINK_PROTOCOL_VERSION,
} from '../../lib/Link/Protocol/Versions.js'

describe('message encoding', () => {
	test('round trips a message', () => {
		const payload = { page: 1, row: 2, column: 3, sourceId: 'abc', pressed: true, surfaceId: 'surface' }
		const decoded = decodeLinkMessage(encodeLinkMessage('button.press', payload))
		expect(decoded).toEqual({ ok: true, message: { version: 1, type: 'button.press', payload } })
	})

	test('rejects invalid json', () => {
		expect(decodeLinkMessage('{nope')).toEqual({ ok: false, error: 'Invalid JSON' })
	})

	test('rejects an unknown envelope version', () => {
		const result = decodeLinkMessage(JSON.stringify({ version: 2, type: 'button.press', payload: {} }))
		expect(result.ok).toBe(false)
	})

	test('rejects an unknown message type', () => {
		const result = decodeLinkMessage(JSON.stringify({ version: 1, type: 'nonsense', payload: {} }))
		expect(result.ok).toBe(false)
	})

	test('rejects a payload that does not match the schema', () => {
		const result = decodeLinkMessage(
			JSON.stringify({ version: 1, type: 'button.press', payload: { page: 'one', row: 0, column: 0 } })
		)
		expect(result.ok).toBe(false)
	})

	test('ignores unknown properties, so that new optional fields are compatible', () => {
		const result = decodeLinkMessage(
			JSON.stringify({
				version: 1,
				type: 'unsubscribe',
				payload: { requestorId: 'abc', buttons: [], somethingNew: 1 },
			})
		)
		expect(result.ok).toBe(true)
	})
})

describe('topics', () => {
	test('discovery topics round trip', () => {
		expect(parseLinkDiscoveryTopic(linkDiscoveryTopic('abc'))).toBe('abc')
	})

	test('other topics are not discovery topics', () => {
		expect(parseLinkDiscoveryTopic('companion-link/abc/inbox')).toBeNull()
		expect(parseLinkDiscoveryTopic('companion-link/discovery/abc/extra')).toBeNull()
		expect(parseLinkDiscoveryTopic('companion-link/discovery/')).toBeNull()
	})

	test('button update topics are unique per location and size', () => {
		const a = linkButtonUpdateTopic('abc', { page: 1, row: 0, column: 0, width: 72, height: 72 })
		const b = linkButtonUpdateTopic('abc', { page: 1, row: 0, column: 0, width: 144, height: 144 })
		expect(a).not.toBe(b)
	})
})

describe('versions', () => {
	test('same major is compatible', () => {
		expect(isLinkProtocolCompatible(LINK_PROTOCOL_VERSION)).toBe(true)
		expect(isLinkProtocolCompatible('1.99.0')).toBe(true)
	})

	test('different major is incompatible', () => {
		expect(isLinkProtocolCompatible('2.0.0')).toBe(false)
		expect(isLinkProtocolCompatible('0.9.0')).toBe(false)
		expect(isLinkProtocolCompatible('garbage')).toBe(false)
	})

	test('features are gated on the peer version', () => {
		expect(getLinkPeerFeatures('1.0.0').rotate).toBe(true)
		expect(getLinkPeerFeatures('2.0.0').rotate).toBe(false)
	})
})

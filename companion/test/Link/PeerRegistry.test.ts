import { describe, expect, test, vi } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncementPayload } from '../../lib/Link/Protocol/Schemas.js'

function announcement(id: string, overrides: Partial<LinkAnnouncementPayload> = {}): LinkAnnouncementPayload {
	return {
		id,
		name: `Peer ${id}`,
		companionVersion: '5.0.0',
		protocolVersion: '1.0.0',
		pageCount: 10,
		grid: { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 },
		announceIntervalMs: 1000,
		...overrides,
	}
}

describe('LinkPeerRegistry', () => {
	test('ignores its own announcements', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('self'), 0)
		expect(registry.getPeers()).toEqual([])
	})

	test('tracks peers across transports', () => {
		const registry = new LinkPeerRegistry('self')
		const reachable = vi.fn()
		registry.on('peerReachable', reachable)

		registry.handleAnnouncement('t1', announcement('a'), 100)
		registry.handleAnnouncement('t2', announcement('a'), 200)
		registry.handleAnnouncement('t1', announcement('a'), 300)

		expect(reachable.mock.calls).toEqual([
			['a', 't1'],
			['a', 't2'],
		])
		expect(registry.getPeer('a')).toMatchObject({ online: true, compatible: true, lastSeen: 300 })
		// Most recently heard from first
		expect(registry.getReachableTransports('a')).toEqual(['t1', 't2'])
	})

	test('goes offline after a goodbye on every transport', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a'), 0)
		registry.handleAnnouncement('t2', announcement('a'), 0)

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.handleTransportDisconnected('t2')
		expect(registry.getPeer('a')).toMatchObject({ online: false, transportIds: [] })
	})

	test('expires peers that stop announcing', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a', { announceIntervalMs: 1000 }), 0)

		registry.expireStale(2000)
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.expireStale(3001)
		expect(registry.getPeer('a')?.online).toBe(false)
	})

	test('lists incompatible peers', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a', { protocolVersion: '2.0.0' }), 0)
		expect(registry.getPeer('a')?.compatible).toBe(false)
	})

	test('forgets peers', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a'), 0)
		registry.forget('a')
		expect(registry.getPeers()).toEqual([])
	})
})

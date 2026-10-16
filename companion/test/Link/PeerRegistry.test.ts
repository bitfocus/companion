import { describe, expect, test, vi } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncementPayload } from '../../lib/Link/Protocol/Schemas.js'

/** A connection that may use everything */
const origin = { connectionId: 'connection', permissions: { buttons: true } }

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
		registry.handleAnnouncement('t1', announcement('self'), origin, 0)
		expect(registry.getPeers()).toEqual([])
	})

	test('tracks peers across transports', () => {
		const registry = new LinkPeerRegistry('self')
		const reachable = vi.fn()
		registry.on('peerReachable', reachable)

		registry.handleAnnouncement('t1', announcement('a'), origin, 100)
		registry.handleAnnouncement('t2', announcement('a'), origin, 200)
		registry.handleAnnouncement('t1', announcement('a'), origin, 300)

		expect(reachable.mock.calls).toEqual([
			['a', 't1'],
			['a', 't2'],
		])
		expect(registry.getPeer('a')).toMatchObject({ online: true, compatible: true, lastSeen: 300 })
		// Most recently heard from first
		expect(registry.getReachableTransports('a', null)).toEqual(['t1', 't2'])
	})

	test('goes offline after a goodbye on every transport', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a'), origin, 0)
		registry.handleAnnouncement('t2', announcement('a'), origin, 0)

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.handleTransportDisconnected('t2')
		expect(registry.getPeer('a')).toMatchObject({ online: false, transportIds: [] })
	})

	test('reports when a peer is no longer reachable on any transport', () => {
		const registry = new LinkPeerRegistry('self')
		const unreachable = vi.fn()
		registry.on('peerUnreachable', unreachable)
		registry.handleAnnouncement('t1', announcement('a'), origin, 0)
		registry.handleAnnouncement('t2', announcement('a'), origin, 0)

		registry.handleTransportDisconnected('t1')
		expect(unreachable).not.toHaveBeenCalled()
		registry.handleGoodbye('t2', 'a')
		expect(unreachable).toHaveBeenCalledWith('a')
	})

	test('expires peers that stop announcing', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a', { announceIntervalMs: 1000 }), origin, 0)

		registry.expireStale(2000)
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.expireStale(3001)
		expect(registry.getPeer('a')?.online).toBe(false)
	})

	test('lists incompatible peers', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a', { protocolVersion: '2.0.0' }), origin, 0)
		expect(registry.getPeer('a')?.compatible).toBe(false)
	})

	test('tracks what is shared each way, per transport', () => {
		const registry = new LinkPeerRegistry('self')
		const sharedChanged = vi.fn()
		registry.on('sharedWithUsChanged', sharedChanged)

		registry.handleAnnouncement('t1', announcement('a'), { connectionId: 'c1', permissions: { buttons: false } }, 0)
		registry.handleAnnouncement('t2', announcement('a'), { connectionId: 'c2', permissions: { buttons: true } }, 0)
		expect(registry.getPeer('a')).toMatchObject({ sharedByUs: { buttons: true }, sharedWithUs: null })
		expect(registry.getSharedByUs('a', 't1')).toEqual({ buttons: false })

		// Until it says otherwise, it may share
		expect(registry.getReachableTransports('a', 'buttons')).toEqual(['t1', 't2'])

		registry.handleAccess('t1', 'a', { buttons: false })
		expect(sharedChanged).toHaveBeenCalledWith('a', 't1')
		expect(registry.getPeer('a')?.sharedWithUs).toEqual({ buttons: false })
		expect(registry.getReachableTransports('a', 'buttons')).toEqual(['t2'])
		expect(registry.getReachableTransports('a', null)).toEqual(['t1', 't2'])

		registry.handleAccess('t2', 'a', { buttons: true })
		expect(registry.getPeer('a')?.sharedWithUs).toEqual({ buttons: true })
	})

	test('updates what we share with the peers on a connection', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a'), { connectionId: 'c1', permissions: { buttons: false } }, 0)
		registry.handleAnnouncement('t1', announcement('b'), { connectionId: 'c2', permissions: { buttons: false } }, 0)

		expect(registry.updateConnectionPermissions('t1', 'c1', { buttons: true })).toEqual(['a'])
		expect(registry.getSharedByUs('a', 't1')).toEqual({ buttons: true })
		expect(registry.getSharedByUs('b', 't1')).toEqual({ buttons: false })
	})

	test('forgets peers', () => {
		const registry = new LinkPeerRegistry('self')
		registry.handleAnnouncement('t1', announcement('a'), origin, 0)
		registry.forget('a')
		expect(registry.getPeers()).toEqual([])
	})
})

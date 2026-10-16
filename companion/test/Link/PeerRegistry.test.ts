import { describe, expect, test, vi } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { LINK_CLOCK_ESTIMATE_MAX_AGE_MS } from '../../lib/Link/Protocol/v1/Timing.js'

/** We share buttons with 'a' only */
const sharedByUs = (peerId: string) => ({ buttons: peerId === 'a' })

function announcement(id: string, overrides: Partial<LinkAnnouncement> = {}): LinkAnnouncement {
	return {
		name: `Peer ${id}`,
		companionVersion: '5.0.0',
		protocolVersions: ['1.0.0'],
		announceIntervalMs: 1000,
		...overrides,
	}
}

describe('LinkPeerRegistry', () => {
	test('ignores its own announcements', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'self', announcement('self'), 0)
		expect(registry.getPeers()).toEqual([])
	})

	test('tracks peers across transports', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		const reachable = vi.fn()
		registry.on('peerReachable', reachable)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 100)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 200)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 300)

		expect(reachable.mock.calls).toEqual([
			['a', 't1'],
			['a', 't2'],
		])
		expect(registry.getPeer('a')).toMatchObject({ online: true, compatible: true, lastSeen: 300 })
		// Most recently heard from first
		expect(registry.getReachableTransports('a', null)).toEqual(['t1', 't2'])
	})

	test('goes offline after a goodbye on every transport', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 0)

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.handleTransportDisconnected('t2')
		expect(registry.getPeer('a')).toMatchObject({ online: false, routes: [] })
	})

	test('reports when a peer is no longer reachable on any transport', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		const unreachable = vi.fn()
		registry.on('peerUnreachable', unreachable)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 0)

		registry.handleTransportDisconnected('t1')
		expect(unreachable).not.toHaveBeenCalled()
		registry.handleGoodbye('t2', 'a')
		expect(unreachable).toHaveBeenCalledWith('a')
	})

	test('expires peers that stop announcing', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a', { announceIntervalMs: 1000 }), 0)

		registry.expireStale(2000)
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.expireStale(3001)
		expect(registry.getPeer('a')?.online).toBe(false)
	})

	test('lists incompatible peers', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a', { protocolVersions: ['2.0.0'] }), 0)
		expect(registry.getPeer('a')).toMatchObject({ compatible: false, protocolVersion: null })

		registry.handleAnnouncement('t1', 'b', announcement('b', { protocolVersions: ['1.3.0', '2.0.0'] }), 0)
		expect(registry.getPeer('b')).toMatchObject({ compatible: true, protocolVersion: '1.3.0' })
	})

	test('tracks what is shared each way, per peer', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		const sharedChanged = vi.fn()
		registry.on('sharedWithUsChanged', sharedChanged)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t1', 'b', announcement('b'), 0)
		expect(registry.getPeer('a')).toMatchObject({ sharedByUs: { buttons: true }, sharedWithUs: null })
		expect(registry.getPeer('b')).toMatchObject({ sharedByUs: { buttons: false }, sharedWithUs: null })

		// Until it says otherwise, it may share
		expect(registry.getReachableTransports('a', 'buttons')).toEqual(['t1', 't2'])

		registry.handleAccess('a', { buttons: false })
		expect(sharedChanged).toHaveBeenCalledWith('a')
		expect(registry.getPeer('a')?.sharedWithUs).toEqual({ buttons: false })
		expect(registry.getReachableTransports('a', 'buttons')).toEqual([])
		expect(registry.getReachableTransports('a', null)).toEqual(['t1', 't2'])

		registry.handleAccess('a', { buttons: true })
		expect(registry.getPeer('a')?.sharedWithUs).toEqual({ buttons: true })
	})

	test('forgets what a peer shares when it is no longer reachable, as it says again when it is', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAccess('a', { buttons: true })
		const shown = vi.fn()
		registry.on('changed', () => shown(registry.getPeer('a')?.sharedWithUs))

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.sharedWithUs).toBeNull()
		expect(shown).toHaveBeenCalledWith(null)
	})

	test('keeps one route to a peer while it works, and picks the fastest when it has to change', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		const routeChanged = vi.fn()
		registry.on('routeChanged', routeChanged)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 10)
		registry.handleAnnouncement('t3', 'a', announcement('a'), 20)
		expect(registry.getRoute('a')).toBe('t1')
		expect(routeChanged.mock.calls).toEqual([['a', 't1']])

		registry.setLatency('a', 't2', 50)
		registry.setLatency('a', 't3', 5)
		expect(registry.getRoute('a')).toBe('t1')

		registry.handleGoodbye('t1', 'a')
		expect(registry.getRoute('a')).toBe('t3')

		registry.handleTransportDisconnected('t3')
		registry.handleGoodbye('t2', 'a')
		expect(registry.getRoute('a')).toBeNull()
		expect(routeChanged.mock.calls.at(-1)).toEqual(['a', null])
	})

	test('forgets peers', () => {
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.forget('a')
		expect(registry.getPeers()).toEqual([])
	})

	test("forgets how far ahead a peer's clock is once that was measured too long ago", () => {
		vi.useFakeTimers({ now: 1_000_000 })
		const registry = new LinkPeerRegistry('self', sharedByUs)
		registry.handleAnnouncement('t1', 'a', announcement('a'), Date.now())
		registry.recordClockSample('a', 500, 10, Date.now())
		expect(registry.getClockOffset('a')).toBe(500)

		// If pongs stop arriving, eg over a transport that drops them, it isn't relied on for ever
		vi.setSystemTime(1_000_000 + LINK_CLOCK_ESTIMATE_MAX_AGE_MS)
		expect(registry.getClockOffset('a')).toBeNull()
		vi.useRealTimers()
	})
})

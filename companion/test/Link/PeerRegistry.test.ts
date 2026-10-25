import { afterEach, describe, expect, test, vi } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { LINK_CLOCK_ESTIMATE_MAX_AGE_MS } from '../../lib/Link/Protocol/v1/Timing.js'
import { FakeTableView } from '../utils/FakeTableView.js'

function announcement(id: string, overrides: Partial<LinkAnnouncement> = {}): LinkAnnouncement {
	return {
		name: `Peer ${id}`,
		companionVersion: '5.0.0',
		protocolVersions: ['1.0.0'],
		announceIntervalMs: 1000,
		...overrides,
	}
}

const emptyStore = () => new FakeTableView<any>().asTableView()

describe('LinkPeerRegistry', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('ignores its own announcements', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'self', announcement('self'), 0)
		expect(registry.getPeers()).toEqual([])
	})

	test('tracks peers across transports', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		const reachable = vi.fn()
		registry.on('peerReachable', reachable)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 100)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 200)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 300)

		expect(reachable.mock.calls).toEqual([
			['a', 't1'],
			['a', 't2'],
		])
		expect(registry.getPeer('a')).toMatchObject({ online: true, compatible: true })
		// Most recently heard from first
		expect(registry.getReachableTransports('a', null)).toEqual(['t1', 't2'])
	})

	test('goes offline after a goodbye on every transport', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 0)

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.handleTransportDisconnected('t2')
		expect(registry.getPeer('a')).toMatchObject({ online: false, routes: [] })
	})

	test('expires peers that stop announcing', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'a', announcement('a', { announceIntervalMs: 1000 }), 0)

		registry.expireStale(2000)
		expect(registry.getPeer('a')?.online).toBe(true)

		registry.expireStale(3001)
		expect(registry.getPeer('a')?.online).toBe(false)
	})

	test('lists incompatible peers', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'a', announcement('a', { protocolVersions: ['2.0.0'] }), 0)
		expect(registry.getPeer('a')).toMatchObject({ compatible: false, protocolVersion: null })

		registry.handleAnnouncement('t1', 'b', announcement('b', { protocolVersions: ['1.3.0', '2.0.0'] }), 0)
		expect(registry.getPeer('b')).toMatchObject({ compatible: true, protocolVersion: '1.3.0' })
	})

	test('tracks what is shared each way, per peer', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		const sharedChanged = vi.fn()
		registry.on('sharedWithUsChanged', sharedChanged)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 0)
		registry.handleAnnouncement('t1', 'b', announcement('b'), 0)
		const sharedByUsChanged = vi.fn()
		registry.on('sharedByUsChanged', sharedByUsChanged)
		registry.setSharedByUs('a', { buttons: true })
		expect(sharedByUsChanged).toHaveBeenCalledWith('a', { buttons: true })
		// Only a listed peer can be shared with
		registry.setSharedByUs('nobody', { buttons: true })
		expect(registry.getSharedByUs('nobody')).toEqual({ buttons: false })
		expect(registry.getSharedByUs('a')).toEqual({ buttons: true })
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
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.handleAccess('a', { buttons: true })
		const shown = vi.fn()
		registry.on('changed', () => shown(registry.getPeer('a')?.sharedWithUs))

		registry.handleGoodbye('t1', 'a')
		expect(registry.getPeer('a')?.sharedWithUs).toBeNull()
		expect(shown).toHaveBeenCalledWith(null)
	})

	test('keeps one route to a peer while it works, and picks the fastest when it has to change', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
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

	test('says the list has changed only when something shown has, not for each repeated announcement', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		const changed = vi.fn()
		const latencyChanged = vi.fn()
		registry.on('changed', changed)
		registry.on('latencyChanged', latencyChanged)

		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		expect(changed).toHaveBeenCalledTimes(1)
		registry.handleAnnouncement('t1', 'a', announcement('a'), 10)
		expect(changed).toHaveBeenCalledTimes(1)

		// Reachable another way, or renamed
		registry.handleAnnouncement('t2', 'a', announcement('a'), 20)
		registry.handleAnnouncement('t2', 'a', announcement('a', { name: 'Renamed' }), 30)
		expect(changed).toHaveBeenCalledTimes(3)

		// A round trip measured again is only shown
		registry.setLatency('a', 't1', 12)
		expect(changed).toHaveBeenCalledTimes(3)
		expect(latencyChanged).toHaveBeenCalledWith('a')
		expect(registry.getRouteLatency('a')).toBe(12)
	})

	test('notices two installations announcing with one Link id, but not one restarting', () => {
		const registry = new LinkPeerRegistry('self', emptyStore())
		const interval = announcement('a').announceIntervalMs
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'one' }), 0)
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'two' }), 10)
		expect(registry.getPeer('a')?.sharesLinkId).toBe(false)

		// Once could be a stale announcement from before it restarted
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'one' }), 20)
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'two' }), 20)
		expect(registry.getPeer('a')?.sharesLinkId).toBe(false)

		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'one' }), 20)
		expect(registry.getPeer('a')?.sharesLinkId).toBe(true)

		// Once only one is seen for a while, eg the other was given a new Link id
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'one' }), 20 + interval * 3)
		registry.expireStale(21 + interval * 3)
		expect(registry.getPeer('a')?.sharesLinkId).toBe(false)
	})

	test('does not save or say the list changed for each flip between two instance ids', () => {
		const store = new FakeTableView<any>()
		const set = vi.spyOn(store, 'set')
		const registry = new LinkPeerRegistry('self', store.asTableView())
		for (const [i, instanceId] of ['one', 'two', 'one'].entries())
			registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId }), i * 10)
		registry.setSharedByUs('a', { buttons: true })
		const changed = vi.fn()
		registry.on('changed', changed)
		registry.handleAnnouncement('t1', 'a', announcement('a', { instanceId: 'two' }), 30)
		expect(changed).not.toHaveBeenCalled()
		expect(set).toHaveBeenCalledTimes(1)
	})

	test('forgets peers, keeping one that is still reachable listed until it is not', () => {
		const store = new FakeTableView<any>()
		const registry = new LinkPeerRegistry('self', store.asTableView())
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.setAlias('a', 'Named')
		registry.setSharedByUs('a', { buttons: true })
		const sharedByUsChanged = vi.fn()
		registry.on('sharedByUsChanged', sharedByUsChanged)
		registry.forget('a')
		// Nothing is shared with it any more, and it is told so while it can still be reached
		expect(sharedByUsChanged).toHaveBeenCalledWith('a', { buttons: false })
		expect(registry.getPeers()).toEqual([
			expect.objectContaining({ id: 'a', alias: null, online: true, sharedByUs: { buttons: false } }),
		])
		expect(registry.isCompatible('a')).toBe(true)
		expect(store.data).toEqual({})

		registry.handleTransportDisconnected('t1')
		expect(store.data).toEqual({})
		registry.forget('a')
		expect(registry.getPeers()).toEqual([])
	})

	test('calls a peer by the name given to it here, across restarts, until that is cleared', () => {
		const store = new FakeTableView<any>()
		const before = new LinkPeerRegistry('self', store.asTableView())
		before.handleAnnouncement('t1', 'a', announcement('a'), 0)
		const changed = vi.fn()
		before.on('changed', changed)

		before.setAlias('a', '  Studio A  ')
		expect(changed).toHaveBeenCalled()
		expect(before.getPeer('a')).toMatchObject({ name: 'Studio A', announcedName: 'Peer a', alias: 'Studio A' })
		// Whatever it announces itself as
		before.handleAnnouncement('t1', 'a', announcement('a', { name: 'Renamed' }), 10)
		expect(before.getPeer('a')).toMatchObject({ name: 'Studio A', announcedName: 'Renamed' })

		const after = new LinkPeerRegistry('self', store.asTableView())
		expect(after.getPeer('a')).toMatchObject({ name: 'Studio A', alias: 'Studio A' })
		after.setAlias('a', '')
		expect(after.getPeer('a')).toMatchObject({ name: 'Renamed', alias: null })
	})

	test('lists the peers seen before a restart as offline', () => {
		const store = new FakeTableView<any>()
		const before = new LinkPeerRegistry('self', store.asTableView())
		before.handleAnnouncement('t1', 'a', announcement('a'), 100)
		before.setSharedByUs('a', { buttons: true })
		vi.useFakeTimers({ now: 200 })
		before.handleAnnouncement('t1', 'a', announcement('a'), 200)
		before.stop()

		const after = new LinkPeerRegistry('self', store.asTableView())
		expect(after.getPeers()).toEqual([
			expect.objectContaining({ id: 'a', name: 'Peer a', online: false, lastSeen: 200, sharedByUs: { buttons: true } }),
		])
		expect(after.getRoute('a')).toBeNull()
		// Nothing it sends is read until it announces again
		expect(after.isCompatible('a')).toBe(false)

		after.handleAnnouncement('t2', 'a', announcement('a'), 300)
		expect(after.getPeer('a')).toMatchObject({ online: true, routes: [{ transportId: 't2', latencyMs: null }] })
	})

	test('saves a peer when it changes, not for every announcement', () => {
		const store = new FakeTableView<any>()
		const set = vi.spyOn(store, 'set')
		vi.useFakeTimers({ now: 0 })
		const registry = new LinkPeerRegistry('self', store.asTableView())
		registry.handleAnnouncement('t1', 'a', announcement('a'), 0)
		registry.setSharedByUs('a', { buttons: true })
		registry.handleAnnouncement('t1', 'a', announcement('a'), 10)
		registry.handleAnnouncement('t2', 'a', announcement('a'), 20)
		expect(set).toHaveBeenCalledTimes(1)

		vi.setSystemTime(30)
		registry.handleAnnouncement('t1', 'a', announcement('a', { name: 'Renamed' }), 30)
		expect(set).toHaveBeenCalledTimes(2)

		// And every so often while it stays online, in case Companion exits without saving
		vi.setSystemTime(5 * 60_000 + 29)
		registry.handleAnnouncement('t1', 'a', announcement('a', { name: 'Renamed' }), 5 * 60_000 + 29)
		expect(set).toHaveBeenCalledTimes(2)
		vi.setSystemTime(5 * 60_000 + 30)
		registry.handleAnnouncement('t1', 'a', announcement('a', { name: 'Renamed' }), 5 * 60_000 + 30)
		expect(set).toHaveBeenCalledTimes(3)

		// Saved with when it was last seen as it goes offline
		registry.handleTransportDisconnected('t1')
		registry.handleTransportDisconnected('t2')
		expect(store.data.a).toEqual({
			announcement: announcement('a', { name: 'Renamed' }),
			lastSeen: 5 * 60_000 + 30,
			alias: null,
			sharedByUs: { buttons: true },
			hasSharedWithUs: false,
		})
	})

	test('remembers only the peers it shares something with, or has named', () => {
		const store = new FakeTableView<any>()
		const registry = new LinkPeerRegistry('self', store.asTableView())
		registry.handleAnnouncement('t1', 'b', announcement('b'), 0)
		expect(store.data).toEqual({})

		registry.setAlias('b', 'Named')
		expect(Object.keys(store.data)).toEqual(['b'])
		registry.setAlias('b', null)
		expect(store.data).toEqual({})

		registry.setSharedByUs('b', { buttons: true })
		expect(Object.keys(store.data)).toEqual(['b'])
		registry.setSharedByUs('b', { buttons: false })
		expect(store.data).toEqual({})
	})

	test('remembers a peer that only shares something with us, across a restart', () => {
		const store = new FakeTableView<any>()
		const before = new LinkPeerRegistry('self', store.asTableView())
		before.handleAnnouncement('t1', 'b', announcement('b'), 0)
		before.handleAccess('b', { buttons: true })
		// Still remembered once it stops sharing, so that buttons using it say it is offline rather than unknown
		before.handleAccess('b', { buttons: false })
		before.stop()

		const after = new LinkPeerRegistry('self', store.asTableView())
		expect(after.getPeer('b')).toMatchObject({ online: false, name: 'Peer b' })
	})

	test('drops stored peers that are itself or not worth remembering, and skips but keeps those it cannot read', () => {
		const store = new FakeTableView<any>()
		store.data = {
			self: { announcement: announcement('self'), lastSeen: 0 },
			bad: { lastSeen: 'yesterday' },
			a: { announcement: announcement('a'), lastSeen: 5, sharedByUs: { buttons: true } },
			unshared: { announcement: announcement('unshared'), lastSeen: 5 },
			// What is shared with it can't be read, so nothing is
			odd: { announcement: announcement('odd'), lastSeen: 5, alias: 'Odd', sharedByUs: 'everything' },
		}
		const registry = new LinkPeerRegistry('self', store.asTableView())
		expect(registry.getPeers().map((peer) => [peer.id, peer.sharedByUs])).toEqual([
			['a', { buttons: true }],
			['odd', { buttons: false }],
		])
		expect(Object.keys(store.data)).toEqual(['bad', 'a', 'odd'])
	})

	test("forgets how far ahead a peer's clock is once that was measured too long ago", () => {
		vi.useFakeTimers({ now: 1_000_000 })
		const registry = new LinkPeerRegistry('self', emptyStore())
		registry.handleAnnouncement('t1', 'a', announcement('a'), Date.now())
		registry.recordClockSample('a', 500, 10, Date.now())
		expect(registry.getClockOffset('a')).toBe(500)

		// If pongs stop arriving, eg over a transport that drops them, it isn't relied on for ever
		vi.setSystemTime(1_000_000 + LINK_CLOCK_ESTIMATE_MAX_AGE_MS)
		expect(registry.getClockOffset('a')).toBeNull()
		vi.useRealTimers()
	})
})

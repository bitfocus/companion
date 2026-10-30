import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import { LinkPinger } from '../../lib/Link/Pinger.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { LINK_CLOCK_ESTIMATE_MAX_AGE_MS, LINK_PING_TIMEOUT_MS } from '../../lib/Link/Protocol/v1/Timing.js'
import { peerStore } from './helpers/PeerStore.js'

function announcement(protocolVersions = ['1.0.0']): LinkAnnouncement {
	return { name: 'Peer', companionVersion: '5.0.0', protocolVersions, announceIntervalMs: 15_000 }
}

function createPinger() {
	const peers = new LinkPeerRegistry('self', peerStore())
	const sent: { peerId: string; transportId: string; nonce: string }[] = []
	/** The monotonic clock, which only the tests move */
	let monotonic = 0
	const pinger = new LinkPinger(
		peers,
		(peerId, transportId, nonce) => sent.push({ peerId, transportId, nonce }),
		() => monotonic
	)
	/** Move both clocks to a time, as they would be with no change to the time of day */
	const at = (time: number) => {
		monotonic = time
		return time
	}
	return { peers, pinger, sent, at, setMonotonic: (time: number) => (monotonic = time) }
}

describe('LinkPinger', () => {
	// A peer's clock is estimated by the time of day, so that is set to when the samples here are taken
	beforeEach(() => vi.useFakeTimers({ now: 0, toFake: ['Date'] }))
	afterEach(() => vi.useRealTimers())

	test('pings every compatible peer over every transport, and records the round trip', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		peers.handleAnnouncement('t2', 'a', announcement(), 0)
		peers.handleAnnouncement('t1', 'old', announcement(['2.0.0']), 0)

		at(1000)
		pinger.pingAll()
		expect(sent.map(({ peerId, transportId }) => [peerId, transportId])).toEqual([
			['a', 't1'],
			['a', 't2'],
		])

		pinger.handlePong('a', 't2', sent[1].nonce, 0, at(1042))
		expect(peers.getPeer('a')?.routes).toEqual([
			{ transportId: 't1', latencyMs: null },
			{ transportId: 't2', latencyMs: 42 },
		])
	})

	test('only accepts a pong from the peer and transport the ping went to, once', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		peers.handleAnnouncement('t2', 'a', announcement(), 0)
		peers.handleAnnouncement('t1', 'b', announcement(), 0)
		at(0)
		pinger.ping('a', 't1')
		const nonce = sent[0].nonce

		pinger.handlePong('b', 't1', nonce, 0, at(10))
		pinger.handlePong('a', 't2', nonce, 0, at(10))
		expect(peers.getPeer('a')?.routes.map((r) => r.latencyMs)).toEqual([null, null])

		pinger.handlePong('a', 't1', nonce, 0, at(20))
		pinger.handlePong('a', 't1', nonce, 0, at(30))
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBe(20)
	})

	test('estimates how far ahead the clock of a peer is, keeping the estimate from the fastest round trip', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		expect(peers.getClockOffset('a')).toBeNull()

		// Sent at 1000, answered at 1050 by the peer's clock (5000 ahead), arriving at 1100
		at(1000)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[0].nonce, 6050, at(1100))
		expect(peers.getClockOffset('a')).toBe(5000)

		// A slower round trip is less accurate, so it doesn't replace it
		at(2000)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[1].nonce, 7300, at(2400))
		expect(peers.getClockOffset('a')).toBe(5000)

		// Forgotten once it is unreachable, as it may come back with its clock changed
		peers.handleTransportDisconnected('t1')
		expect(peers.getClockOffset('a')).toBeNull()
	})

	test('replaces an old estimate, in case the clock has been corrected', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		at(0)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[0].nonce, 5005, at(10))

		const later = LINK_CLOCK_ESTIMATE_MAX_AGE_MS + 1000
		at(later)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[1].nonce, later + 100, at(later + 200))
		expect(peers.getClockOffset('a')).toBe(0)
	})

	test('times the round trip by a clock that a change to the time of day does not affect', () => {
		const { peers, pinger, sent, setMonotonic } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		setMonotonic(1000)
		pinger.ping('a', 't1')

		// Our time of day was set back an hour during the round trip of 40ms
		setMonotonic(1040)
		pinger.handlePong('a', 't1', sent[0].nonce, 5_000, 1040 - 3_600_000)
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBe(40)
	})

	test('replaces an estimate that a new measurement can not agree with, as a clock has been changed', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		at(1000)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[0].nonce, 6050, at(1100))
		expect(peers.getClockOffset('a')).toBe(5000)

		// The peer's clock was set back by NTP: a slower round trip, but one that is 5s out
		at(2000)
		pinger.ping('a', 't1')
		pinger.handlePong('a', 't1', sent[1].nonce, 2200, at(2400))
		expect(peers.getClockOffset('a')).toBe(0)
	})

	test('gives up on pings that are not answered in time', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		at(0)
		pinger.ping('a', 't1')

		at(LINK_PING_TIMEOUT_MS + 1)
		pinger.pingAll()
		pinger.handlePong('a', 't1', sent[0].nonce, 0, at(LINK_PING_TIMEOUT_MS + 2))
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBeNull()
	})

	test('ignores a pong that arrives after the ping timed out, before the next round gives up on it', () => {
		const { peers, pinger, sent, at } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		at(0)
		pinger.ping('a', 't1')

		pinger.handlePong('a', 't1', sent[0].nonce, 0, at(LINK_PING_TIMEOUT_MS + 1))
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBeNull()
		expect(peers.getClockOffset('a')).toBeNull()
	})
})

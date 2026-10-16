import { describe, expect, test } from 'vitest'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import { LinkPinger } from '../../lib/Link/Pinger.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { LINK_PING_TIMEOUT_MS } from '../../lib/Link/Protocol/v1/Topics.js'

function announcement(protocolVersions = ['1.0.0']): LinkAnnouncement {
	return { name: 'Peer', companionVersion: '5.0.0', protocolVersions, announceIntervalMs: 15_000 }
}

function createPinger() {
	const peers = new LinkPeerRegistry('self', () => ({ buttons: false }))
	const sent: { peerId: string; transportId: string; nonce: string }[] = []
	const pinger = new LinkPinger(peers, (peerId, transportId, nonce) => sent.push({ peerId, transportId, nonce }))
	return { peers, pinger, sent }
}

describe('LinkPinger', () => {
	test('pings every compatible peer over every transport, and records the round trip', () => {
		const { peers, pinger, sent } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		peers.handleAnnouncement('t2', 'a', announcement(), 0)
		peers.handleAnnouncement('t1', 'old', announcement(['2.0.0']), 0)

		pinger.pingAll(1000)
		expect(sent.map(({ peerId, transportId }) => [peerId, transportId])).toEqual([
			['a', 't1'],
			['a', 't2'],
		])

		pinger.handlePong('a', 't2', sent[1].nonce, 1042)
		expect(peers.getPeer('a')?.routes).toEqual([
			{ transportId: 't1', latencyMs: null },
			{ transportId: 't2', latencyMs: 42 },
		])
	})

	test('only accepts a pong from the peer and transport the ping went to, once', () => {
		const { peers, pinger, sent } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		peers.handleAnnouncement('t2', 'a', announcement(), 0)
		peers.handleAnnouncement('t1', 'b', announcement(), 0)
		pinger.ping('a', 't1', 0)
		const nonce = sent[0].nonce

		pinger.handlePong('b', 't1', nonce, 10)
		pinger.handlePong('a', 't2', nonce, 10)
		expect(peers.getPeer('a')?.routes.map((r) => r.latencyMs)).toEqual([null, null])

		pinger.handlePong('a', 't1', nonce, 20)
		pinger.handlePong('a', 't1', nonce, 30)
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBe(20)
	})

	test('gives up on pings that are not answered in time', () => {
		const { peers, pinger, sent } = createPinger()
		peers.handleAnnouncement('t1', 'a', announcement(), 0)
		pinger.ping('a', 't1', 0)

		pinger.pingAll(LINK_PING_TIMEOUT_MS + 1)
		pinger.handlePong('a', 't1', sent[0].nonce, LINK_PING_TIMEOUT_MS + 2)
		expect(peers.getPeer('a')?.routes[0].latencyMs).toBeNull()
	})
})

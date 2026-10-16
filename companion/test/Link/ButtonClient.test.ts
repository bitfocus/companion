import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LINK_BUTTON_BITMAP_SIZE, LINK_UNREACHABLE_GRACE_MS, LinkButtonClient } from '../../lib/Link/ButtonClient.js'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { linkButtonUpdateTopic, linkInboxTopic } from '../../lib/Link/Protocol/v1/Topics.js'

/** A connection that may use everything */

function announcement(id: string, protocolVersions = ['1.0.0']): LinkAnnouncement {
	return {
		name: `Peer ${id}`,
		companionVersion: '5.0.0',
		protocolVersions,
		announceIntervalMs: 1000,
	}
}

const location = { pageNumber: 1, row: 0, column: 2 }
const button = { type: 'location', page: 1, row: 0, column: 2 } as const
const sub = { button, width: LINK_BUTTON_BITMAP_SIZE, height: LINK_BUTTON_BITMAP_SIZE }
const updateTopic = linkButtonUpdateTopic('peer', sub)

function update(sourceChain: string[]) {
	return { ...sub, dataUrl: 'data:image/png;base64,AAAA', pressed: true, sourceChain }
}

function createClient() {
	const peers = new LinkPeerRegistry('self', () => ({ buttons: false }))
	const sent: { transportId: string; topic: string; type: string; payload: any }[] = []
	const transports = {
		publishTo: (transportId: string, topic: string, payload: string) => {
			const decoded = decodeLinkMessage(payload)
			if (!decoded.ok) throw new Error(decoded.error)
			sent.push({ transportId, topic, type: decoded.message.type, payload: decoded.message.payload })
		},
		subscribeOn: vi.fn(),
		unsubscribeFrom: vi.fn(),
	}
	const client = new LinkButtonClient(() => 'self', peers, transports)
	return { client, peers, transports, sent }
}

describe('LinkButtonClient', () => {
	let ctx: ReturnType<typeof createClient>
	beforeEach(() => {
		ctx = createClient()
	})

	test('an unknown peer is reported, and nothing is sent', () => {
		const onChange = vi.fn()
		ctx.client.setTarget('c1', { peerId: 'peer', location }, onChange)

		expect(ctx.client.getState('c1')?.status).toBe('unknown_peer')
		expect(ctx.transports.subscribeOn).not.toHaveBeenCalled()
		expect(ctx.sent).toEqual([])
	})

	test('subscribes once the peer is discovered, and shows its updates', () => {
		const onChange = vi.fn()
		ctx.client.setTarget('c1', { peerId: 'peer', location }, onChange)
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)

		expect(ctx.client.getState('c1')?.status).toBe('loading')
		expect(ctx.transports.subscribeOn).toHaveBeenCalledWith('t1', updateTopic)
		expect(ctx.sent).toEqual([
			{
				transportId: 't1',
				topic: linkInboxTopic('peer'),
				type: 'subscribe',
				payload: { buttons: [sub], sendCurrent: true },
			},
		])

		ctx.client.handleUpdate(updateTopic, update(['peer']))
		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', pressed: true, peerName: 'Peer peer' })
		expect(onChange).toHaveBeenCalled()
	})

	test('buttons showing the same remote button share a subscription', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.setTarget('c2', { peerId: 'peer', location }, vi.fn())

		expect(ctx.transports.subscribeOn).toHaveBeenCalledTimes(1)
		expect(ctx.sent.filter((m) => m.type === 'subscribe')).toHaveLength(1)
		expect(ctx.client.countSubscribedTo('peer')).toBe(1)

		ctx.client.removeTarget('c1')
		expect(ctx.transports.unsubscribeFrom).not.toHaveBeenCalled()

		ctx.client.removeTarget('c2')
		expect(ctx.client.countSubscribedTo('peer')).toBe(0)
		expect(ctx.transports.unsubscribeFrom).toHaveBeenCalledWith('t1', updateTopic)
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'unsubscribe', payload: { buttons: [sub] } })
	})

	test('detects loops', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.handleUpdate(updateTopic, update(['self', 'peer']))

		expect(ctx.client.getState('c1')?.status).toBe('loop')
	})

	test('keeps showing the last image briefly when a peer drops out, then shows it offline', () => {
		vi.useFakeTimers()
		try {
			const client = createClient()
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			client.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
			client.client.handleUpdate(updateTopic, update(['peer']))

			client.peers.handleTransportDisconnected('t1')
			expect(client.client.getState('c1')?.status).toBe('ok')

			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)
			expect(client.client.getState('c1')?.status).toBe('offline')

			// Back again: it asks for the current state
			client.sent.length = 0
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			expect(client.client.getState('c1')?.status).toBe('ok')
			expect(client.sent).toMatchObject([{ type: 'subscribe', payload: { sendCurrent: true } }])
		} finally {
			vi.useRealTimers()
		}
	})

	test('a brief drop goes unnoticed', () => {
		vi.useFakeTimers()
		try {
			const client = createClient()
			const onChange = vi.fn()
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			client.client.setTarget('c1', { peerId: 'peer', location }, onChange)
			client.client.handleUpdate(updateTopic, update(['peer']))
			onChange.mockClear()

			client.peers.handleTransportDisconnected('t1')
			vi.advanceTimersByTime(1000)
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)

			expect(client.client.getState('c1')?.status).toBe('ok')
			expect(onChange).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	test('a peer that dropped out before the button was made is shown offline once the grace period is over', () => {
		vi.useFakeTimers()
		try {
			const client = createClient()
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			client.peers.handleTransportDisconnected('t1')
			client.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
			expect(client.client.getState('c1')?.status).toBe('loading')

			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)
			expect(client.client.getState('c1')?.status).toBe('offline')
		} finally {
			vi.useRealTimers()
		}
	})

	test('a peer that does not share its buttons is reported, and not asked for them', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.peers.handleAccess('peer', { buttons: false })
		expect(ctx.client.getState('c1')?.status).toBe('denied')

		ctx.sent.length = 0
		ctx.client.press('c1', true, 'deck')
		ctx.client.renewAll()
		expect(ctx.sent).toEqual([])
	})

	test('subscribes again when a peer starts sharing its buttons', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAccess('peer', { buttons: false })
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.peers.handleAccess('peer', { buttons: true })
		expect(ctx.sent).toMatchObject([{ transportId: 't1', type: 'subscribe', payload: { sendCurrent: true } }])
		expect(ctx.client.getState('c1')?.status).toBe('loading')
	})

	test('reports incompatible peers', () => {
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())

		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer', ['2.0.0']), 0)
		expect(ctx.client.getState('c1')?.status).toBe('incompatible')
	})

	test('does not send to an incompatible peer', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer', ['2.0.0']), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.press('c1', true, 'deck')
		expect(ctx.sent).toEqual([])
	})

	test('sends everything over the route to the peer only', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', 'peer', announcement('peer'), 10)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		expect(ctx.sent.map((m) => [m.transportId, m.type])).toEqual([['t1', 'subscribe']])
		ctx.sent.length = 0

		ctx.client.press('c1', true, 'deck')
		ctx.client.renewAll()
		expect(ctx.sent.map((m) => [m.transportId, m.type])).toEqual([
			['t1', 'button.press'],
			['t1', 'subscribe'],
		])
		expect(ctx.sent[0]).toEqual({
			transportId: 't1',
			topic: linkInboxTopic('peer'),
			type: 'button.press',
			payload: { button, pressed: true, surfaceId: 'deck' },
		})
	})

	test('renews subscriptions without asking for the current state', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.client.renewAll()
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.sendCurrent])).toEqual([['t1', 'subscribe', false]])
	})

	test('moves to another route when the current one stops reaching the peer, and asks for the current state', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.peers.handleTransportDisconnected('t1')
		expect(ctx.transports.unsubscribeFrom).toHaveBeenCalledWith('t1', updateTopic)
		expect(ctx.transports.subscribeOn).toHaveBeenLastCalledWith('t2', updateTopic)
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.sendCurrent])).toEqual([['t2', 'subscribe', true]])
	})

	test('changing the target moves the subscription', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.setTarget('c1', { peerId: 'peer', location: { ...location, column: 3 } }, vi.fn())

		expect(ctx.transports.unsubscribeFrom).toHaveBeenCalledWith('t1', updateTopic)
		expect(ctx.transports.subscribeOn).toHaveBeenLastCalledWith(
			't1',
			linkButtonUpdateTopic('peer', { ...sub, button: { ...button, column: 3 } })
		)
	})
})

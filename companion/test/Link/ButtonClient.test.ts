import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LINK_BUTTON_BITMAP_SIZE, LINK_UNREACHABLE_GRACE_MS, LinkButtonClient } from '../../lib/Link/ButtonClient.js'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import { decodeLinkMessage, type LinkAnnouncementPayload } from '../../lib/Link/Protocol/Schemas.js'
import { linkButtonUpdateTopic, linkInboxTopic } from '../../lib/Link/Protocol/Topics.js'

function announcement(id: string, protocolVersion = '1.0.0'): LinkAnnouncementPayload {
	return {
		id,
		name: `Peer ${id}`,
		companionVersion: '5.0.0',
		protocolVersion,
		pageCount: 10,
		grid: { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 },
		announceIntervalMs: 1000,
	}
}

const location = { pageNumber: 1, row: 0, column: 2 }
const sub = { page: 1, row: 0, column: 2, width: LINK_BUTTON_BITMAP_SIZE, height: LINK_BUTTON_BITMAP_SIZE }
const updateTopic = linkButtonUpdateTopic('peer', sub)

function update(sourceChain: string[]) {
	return { ...sub, dataUrl: 'data:image/png;base64,AAAA', pressed: true, sourceChain }
}

function createClient() {
	const peers = new LinkPeerRegistry('self')
	const sent: { transportId: string; topic: string; type: string; payload: any }[] = []
	const transports = {
		publishTo: (transportId: string, topic: string, payload: string) => {
			const decoded = decodeLinkMessage(payload)
			if (!decoded.ok) throw new Error(decoded.error)
			sent.push({ transportId, topic, type: decoded.message.type, payload: decoded.message.payload })
		},
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
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
		expect(ctx.transports.subscribe).toHaveBeenCalledWith(updateTopic)
		expect(ctx.sent).toEqual([])
	})

	test('subscribes once the peer is discovered, and shows its updates', () => {
		const onChange = vi.fn()
		ctx.client.setTarget('c1', { peerId: 'peer', location }, onChange)
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)

		expect(ctx.client.getState('c1')?.status).toBe('loading')
		expect(ctx.sent).toEqual([
			{
				transportId: 't1',
				topic: linkInboxTopic('peer'),
				type: 'subscribe',
				payload: { requestorId: 'self', buttons: [sub], sendCurrent: true },
			},
		])

		ctx.client.handleUpdate(updateTopic, update(['peer']))
		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', pressed: true, peerName: 'Peer peer' })
		expect(onChange).toHaveBeenCalled()
	})

	test('buttons showing the same remote button share a subscription', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.setTarget('c2', { peerId: 'peer', location }, vi.fn())

		expect(ctx.transports.subscribe).toHaveBeenCalledTimes(1)
		expect(ctx.sent.filter((m) => m.type === 'subscribe')).toHaveLength(1)

		ctx.client.removeTarget('c1')
		expect(ctx.transports.unsubscribe).not.toHaveBeenCalled()

		ctx.client.removeTarget('c2')
		expect(ctx.transports.unsubscribe).toHaveBeenCalledWith(updateTopic)
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'unsubscribe', payload: { requestorId: 'self', buttons: [sub] } })
	})

	test('detects loops', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.handleUpdate(updateTopic, update(['self', 'peer']))

		expect(ctx.client.getState('c1')?.status).toBe('loop')
	})

	test('keeps showing the last image briefly when a peer drops out, then shows it offline', () => {
		vi.useFakeTimers()
		try {
			const client = createClient()
			client.peers.handleAnnouncement('t1', announcement('peer'), 0)
			client.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
			client.client.handleUpdate(updateTopic, update(['peer']))

			client.peers.handleTransportDisconnected('t1')
			expect(client.client.getState('c1')?.status).toBe('ok')

			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)
			expect(client.client.getState('c1')?.status).toBe('offline')

			// Back again: it asks for the current state
			client.sent.length = 0
			client.peers.handleAnnouncement('t1', announcement('peer'), 0)
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
			client.peers.handleAnnouncement('t1', announcement('peer'), 0)
			client.client.setTarget('c1', { peerId: 'peer', location }, onChange)
			client.client.handleUpdate(updateTopic, update(['peer']))
			onChange.mockClear()

			client.peers.handleTransportDisconnected('t1')
			vi.advanceTimersByTime(1000)
			client.peers.handleAnnouncement('t1', announcement('peer'), 0)
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
			client.peers.handleAnnouncement('t1', announcement('peer'), 0)
			client.peers.handleTransportDisconnected('t1')
			client.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
			expect(client.client.getState('c1')?.status).toBe('loading')

			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)
			expect(client.client.getState('c1')?.status).toBe('offline')
		} finally {
			vi.useRealTimers()
		}
	})

	test('reports incompatible peers', () => {
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())

		ctx.peers.handleAnnouncement('t1', announcement('peer', '2.0.0'), 0)
		expect(ctx.client.getState('c1')?.status).toBe('incompatible')
	})

	test('does not send to an incompatible peer', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer', '2.0.0'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.press('c1', true, 'deck')
		expect(ctx.sent).toEqual([])
	})

	test('sends presses on one transport only', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', announcement('peer'), 10)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.client.press('c1', true, 'deck')
		expect(ctx.sent).toEqual([
			{
				transportId: 't2',
				topic: linkInboxTopic('peer'),
				type: 'button.press',
				payload: { page: 1, row: 0, column: 2, sourceId: 'self', pressed: true, surfaceId: 'deck' },
			},
		])
	})

	test('renews subscriptions on every transport, without asking for the current state', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.client.renewAll()
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.sendCurrent])).toEqual([
			['t1', 'subscribe', false],
			['t2', 'subscribe', false],
		])
	})

	test('changing the target moves the subscription', () => {
		ctx.peers.handleAnnouncement('t1', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.setTarget('c1', { peerId: 'peer', location: { ...location, column: 3 } }, vi.fn())

		expect(ctx.transports.unsubscribe).toHaveBeenCalledWith(updateTopic)
		expect(ctx.transports.subscribe).toHaveBeenLastCalledWith(linkButtonUpdateTopic('peer', { ...sub, column: 3 }))
	})
})

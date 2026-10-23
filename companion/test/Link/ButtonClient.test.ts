import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LINK_BUTTON_BITMAP_SIZE, LINK_UNREACHABLE_GRACE_MS, LinkButtonClient } from '../../lib/Link/ButtonClient.js'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { FakeTableView } from '../utils/FakeTableView.js'

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

const revision = { stream: 's1', seq: 1 }

function update(sourceChain: string[], updateRevision = revision, pressed = true) {
	return { ...sub, revision: updateRevision, dataUrl: 'data:image/png;base64,AAAA', pressed, sourceChain }
}

function createClient() {
	const peers = new LinkPeerRegistry('self', () => ({ buttons: false }), new FakeTableView<any>().asTableView())
	const sent: { transportId: string; peerId: string; type: string; payload: any }[] = []
	const client = new LinkButtonClient(
		() => 'self',
		peers,
		(transportId, peerId, payload) => {
			const decoded = decodeLinkMessage(payload)
			if (!decoded.ok) throw new Error(decoded.error)
			sent.push({ transportId, peerId, type: decoded.message.type, payload: decoded.message.payload })
		}
	)
	return { client, peers, sent }
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
		expect(ctx.sent).toEqual([])
	})

	test('subscribes once the peer is discovered, and shows its updates', () => {
		const onChange = vi.fn()
		ctx.client.setTarget('c1', { peerId: 'peer', location }, onChange)
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)

		expect(ctx.client.getState('c1')?.status).toBe('loading')
		expect(ctx.sent).toEqual([
			{
				transportId: 't1',
				peerId: 'peer',
				type: 'subscribe',
				payload: { buttons: [{ ...sub, have: null }] },
			},
		])

		ctx.client.handleUpdate('peer', update(['peer']))
		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', pressed: true, peerName: 'Peer peer' })
		expect(onChange).toHaveBeenCalled()
	})

	test('buttons showing the same remote button share a subscription', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.setTarget('c2', { peerId: 'peer', location }, vi.fn())

		expect(ctx.sent.filter((m) => m.type === 'subscribe')).toHaveLength(1)
		expect(ctx.client.countSubscribedTo('peer')).toBe(1)

		ctx.client.removeTarget('c1')
		expect(ctx.sent.filter((m) => m.type === 'unsubscribe')).toHaveLength(0)

		ctx.client.removeTarget('c2')
		expect(ctx.client.countSubscribedTo('peer')).toBe(0)
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'unsubscribe', payload: { buttons: [sub] } })
	})

	test('detects loops', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.handleUpdate('peer', update(['self', 'peer']))

		expect(ctx.client.getState('c1')?.status).toBe('loop')
	})

	test('keeps showing the last image briefly when a peer drops out, then shows it offline', () => {
		vi.useFakeTimers()
		try {
			const client = createClient()
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			client.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
			client.client.handleUpdate('peer', update(['peer']))

			client.peers.handleTransportDisconnected('t1')
			expect(client.client.getState('c1')?.status).toBe('ok')

			vi.advanceTimersByTime(LINK_UNREACHABLE_GRACE_MS)
			expect(client.client.getState('c1')?.status).toBe('offline')

			// Back again: it says what it has, to be sent anything it missed
			client.sent.length = 0
			client.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
			expect(client.client.getState('c1')?.status).toBe('ok')
			expect(client.sent).toMatchObject([{ type: 'subscribe', payload: { buttons: [{ have: revision }] } }])
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
			client.client.handleUpdate('peer', update(['peer']))
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
		expect(ctx.sent).toMatchObject([{ transportId: 't1', type: 'subscribe', payload: { buttons: [{ have: null }] } }])
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
			peerId: 'peer',
			type: 'button.press',
			payload: { id: expect.any(String), expiresAt: expect.any(Number), button, pressed: true, surfaceId: 'deck' },
		})
	})

	test('releases what it holds where it pressed it, when it is given another target or deleted', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.press('c1', true, 'deck')
		ctx.client.press('c1', true, 'other-deck')
		ctx.sent.length = 0

		ctx.client.setTarget('c1', { peerId: 'peer', location: { ...location, column: 3 } }, vi.fn())
		const presses = () => ctx.sent.filter((m) => m.type === 'button.press').map((m) => m.payload)
		expect(presses()).toMatchObject([
			{ button, pressed: false, surfaceId: 'deck' },
			{ button, pressed: false, surfaceId: 'other-deck' },
		])

		// Released already, so not released again, and not at the new target either
		ctx.sent.length = 0
		ctx.client.press('c1', false, 'deck')
		expect(presses()).toEqual([])

		// Pressed at the new target, then deleted while held
		ctx.client.press('c1', true, 'deck')
		ctx.sent.length = 0
		ctx.client.removeTarget('c1')
		expect(presses()).toMatchObject([{ button: { ...button, column: 3 }, pressed: false, surfaceId: 'deck' }])
	})

	test('sends aborts to the remote button', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.client.abort('c1', true, 2)
		ctx.client.abort('unknown', true, 0)
		expect(ctx.sent).toEqual([
			{
				transportId: 't1',
				peerId: 'peer',
				type: 'button.abort',
				payload: { id: expect.any(String), expiresAt: expect.any(Number), button, unlatch: true, hops: 2 },
			},
		])
	})

	test('renews subscriptions saying which revision it has of each button', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0

		ctx.client.renewAll()
		ctx.client.handleUpdate('peer', update(['peer']))
		ctx.client.renewAll()
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.buttons[0].have])).toEqual([
			['t1', 'subscribe', null],
			['t1', 'subscribe', revision],
		])
	})

	test('says why a button is refused, until an update says it is served after all', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())

		// Only for the button and size refused, from the peer subscribed to
		ctx.client.handleRefused('other', { buttons: [{ ...sub, reason: 'limit' }] })
		ctx.client.handleRefused('peer', { buttons: [{ ...sub, width: 72, height: 72, reason: 'limit' }] })
		expect(ctx.client.getState('c1')?.status).toBe('loading')

		ctx.client.handleRefused('peer', { buttons: [{ ...sub, reason: 'limit' }] })
		expect(ctx.client.getState('c1')?.status).toBe('over_limit')
		ctx.client.handleRefused('peer', { buttons: [{ ...sub, reason: 'denied' }] })
		expect(ctx.client.getState('c1')?.status).toBe('denied')

		ctx.client.handleUpdate('peer', update(['peer']))
		expect(ctx.client.getState('c1')?.status).toBe('ok')
	})

	test('keeps the newest update, whatever order they arrive in', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())

		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's1', seq: 2 }, true))
		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's1', seq: 1 }, false))
		expect(ctx.client.getState('c1')?.pressed).toBe(true)

		// A new stream, eg the peer restarted, replaces it
		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's2', seq: 0 }, false))
		expect(ctx.client.getState('c1')?.pressed).toBe(false)
	})

	test('moves to another route when the current one stops reaching the peer, saying what it has', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.client.handleUpdate('peer', update(['peer']))
		ctx.sent.length = 0

		ctx.peers.handleTransportDisconnected('t1')
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.buttons[0].have])).toEqual([
			['t2', 'subscribe', revision],
		])
	})

	test('changing the target moves the subscription', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		ctx.sent.length = 0
		ctx.client.setTarget('c1', { peerId: 'peer', location: { ...location, column: 3 } }, vi.fn())

		expect(ctx.sent.map((m) => [m.type, m.payload.buttons[0].button.column])).toEqual([
			['unsubscribe', 2],
			['subscribe', 3],
		])
	})

	test('only accepts updates for a button subscribed to with the peer that sent it', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())

		ctx.client.handleUpdate('someone-else', update(['someone-else']))
		ctx.client.handleUpdate('peer', { ...update(['peer']), width: 72, height: 72 })
		ctx.client.handleUpdate('peer', { ...update(['peer']), button: { ...button, column: 3 } })
		expect(ctx.client.getState('c1')?.status).toBe('loading')

		ctx.client.handleUpdate('peer', update(['peer']))
		expect(ctx.client.getState('c1')?.status).toBe('ok')
	})
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import {
	LINK_SIZE_RELEASE_GRACE_MS,
	LINK_UNREACHABLE_GRACE_MS,
	LinkButtonClient,
	linkCoalesceWaitMs,
	linkImageWaitMs,
} from '../../lib/Link/ButtonClient.js'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import type { LinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, type LinkButtonRevision } from '../../lib/Link/Protocol/v1/Schemas.js'
import { LinkRemoteImageStore } from '../../lib/Link/RemoteImageStore.js'
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
/** Shown as a 72px square, which is asked for at 144px */
const square = { width: 72, height: 72 }
const sub = { button, width: 144, height: 144 }
/** Shown as a 2:1 strip, which is asked for with a 144px short edge */
const wide = { width: 200, height: 100 }
const wideSub = { button, width: 288, height: 144 }

const revision = { stream: 's1', seq: 1 }

function update(
	sourceChain: string[],
	updateRevision: LinkButtonRevision = revision,
	pressed = true,
	size: { width: number; height: number } = sub
) {
	return {
		button,
		width: size.width,
		height: size.height,
		revision: updateRevision,
		dataUrl: `data:image/png;base64,${size.width}x${size.height}-${updateRevision.seq}`,
		pressed,
		stepCurrent: 2,
		stepCount: 3,
		status: 'warning' as const,
		actionRunning: true,
		sourceChain,
	}
}

/** No decoration: the content of a button is the whole of it */
function noDecoration(size: { width: number; height: number }, _decoration: ButtonGraphicsDecorationType) {
	return size
}

function createClient(contentSize = noDecoration) {
	const images = new LinkRemoteImageStore()
	const peers = new LinkPeerRegistry('self', () => ({ buttons: false }), new FakeTableView<any>().asTableView())
	const sent: { transportId: string; peerId: string; type: string; payload: any }[] = []
	const client = new LinkButtonClient(
		() => 'self',
		peers,
		(transportId, peerId, payload) => {
			const decoded = decodeLinkMessage(payload)
			if (!decoded.ok) throw new Error(decoded.error)
			sent.push({ transportId, peerId, type: decoded.message.type, payload: decoded.message.payload })
		},
		contentSize,
		images
	)
	return { client, peers, sent, images }
}

/** Let the subscriptions made together be sent */
async function flushSubscribes(): Promise<void> {
	await new Promise((resolve) => setImmediate(resolve))
}

describe('LinkButtonClient', () => {
	let ctx: ReturnType<typeof createClient>
	beforeEach(() => {
		ctx = createClient()
	})
	afterEach(() => {
		ctx.client.stop()
		vi.useRealTimers()
	})

	/** Show a link button to the remote button, at sizes */
	function show(controlId: string, sizes = [square], onChange = vi.fn()) {
		ctx.client.setTarget(controlId, { peerId: 'peer', location }, onChange)
		ctx.client.setDisplayedSizes(controlId, sizes)
		return onChange
	}

	test('an unknown peer is reported, and nothing is sent', async () => {
		show('c1')
		await flushSubscribes()

		expect(ctx.client.getState('c1')?.status).toBe('unknown_peer')
		expect(ctx.sent).toEqual([])
	})

	test('subscribes once the peer is discovered, and shows its updates', async () => {
		const onChange = show('c1')
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		await flushSubscribes()

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
		expect(ctx.client.getState('c1')).toMatchObject({
			status: 'ok',
			pressed: true,
			stepCurrent: 2,
			stepCount: 3,
			buttonStatus: 'warning',
			actionRunning: true,
			peerName: 'Peer peer',
			images: [{ width: 144, height: 144, dataUrl: update(['peer']).dataUrl, revision, current: true }],
		})
		expect(onChange).toHaveBeenCalled()
	})

	test('a button is only subscribed to while it is shown', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.client.setTarget('c1', { peerId: 'peer', location }, vi.fn())
		await vi.advanceTimersByTimeAsync(0)
		expect(ctx.sent).toEqual([])
		expect(ctx.client.countSubscribedTo('peer')).toBe(0)

		ctx.client.setDisplayedSizes('c1', [square])
		await vi.advanceTimersByTimeAsync(0)
		expect(ctx.sent.map((m) => m.type)).toEqual(['subscribe'])

		// Gone and back within the grace period, eg paging past it: nothing changes
		ctx.client.setDisplayedSizes('c1', [])
		await vi.advanceTimersByTimeAsync(LINK_SIZE_RELEASE_GRACE_MS - 1)
		ctx.client.setDisplayedSizes('c1', [square])
		await vi.advanceTimersByTimeAsync(LINK_SIZE_RELEASE_GRACE_MS)
		expect(ctx.sent.map((m) => m.type)).toEqual(['subscribe'])

		ctx.client.setDisplayedSizes('c1', [])
		await vi.advanceTimersByTimeAsync(LINK_SIZE_RELEASE_GRACE_MS)
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'unsubscribe', payload: { buttons: [sub] } })
		expect(ctx.client.countSubscribedTo('peer')).toBe(0)
	})

	test('subscribes once for each shape it is shown at, at the largest size of that shape, together', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1', [square, { width: 200, height: 200 }])
		show('c2', [wide])
		await flushSubscribes()

		expect(ctx.sent).toMatchObject([
			{
				type: 'subscribe',
				payload: {
					buttons: [
						{ ...sub, width: 200, height: 200, have: null },
						{ ...wideSub, have: null },
					],
				},
			},
		])
		expect(ctx.client.countSubscribedTo('peer')).toBe(1)
	})

	test('subscribes at the size of the content of the button, under its decoration', async () => {
		// A top bar a quarter of the height by default, and a button can have one of half its height
		let topBar = true
		ctx = createClient((size, decoration) => {
			if (decoration === ButtonGraphicsDecorationType.TopBar) return { width: size.width, height: size.height / 2 }
			if (decoration === ButtonGraphicsDecorationType.FollowDefault && topBar) {
				return { width: size.width, height: (size.height * 3) / 4 }
			}
			return size
		})
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1', [{ width: 200, height: 200 }])
		await flushSubscribes()
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'subscribe', payload: { buttons: [{ width: 200, height: 150 }] } })

		// The decoration changes
		topBar = false
		ctx.client.refreshDisplayedSizes()
		await flushSubscribes()
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'subscribe', payload: { buttons: [{ width: 200, height: 200 }] } })

		// The button has a top bar of its own
		ctx.client.setDecoration('c1', ButtonGraphicsDecorationType.TopBar)
		await flushSubscribes()
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'subscribe', payload: { buttons: [{ width: 288, height: 144 }] } })
	})

	test('subscribes, renews and unsubscribes in chunks a peer accepts, however many buttons are shown', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		for (let column = 0; column < 450; column++) {
			ctx.client.setTarget(`c${column}`, { peerId: 'peer', location: { ...location, column } }, vi.fn())
			ctx.client.setDisplayedSizes(`c${column}`, [square])
		}
		await flushSubscribes()

		// Each is decoded as the peer would, which rejects a message listing too many
		const counts = (type: string) => ctx.sent.filter((m) => m.type === type).map((m) => m.payload.buttons.length)
		expect(counts('subscribe')).toEqual([200, 200, 50])

		ctx.sent.length = 0
		ctx.client.renewAll()
		expect(counts('subscribe')).toEqual([200, 200, 50])

		ctx.sent.length = 0
		for (let column = 0; column < 450; column++) ctx.client.removeTarget(`c${column}`)
		expect(counts('unsubscribe').reduce((a, b) => a + b, 0)).toBe(450)
		expect(Math.max(...counts('unsubscribe'))).toBeLessThanOrEqual(200)
	})

	test('buttons showing the same remote button share its subscriptions', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		show('c2')
		await flushSubscribes()

		expect(ctx.sent.filter((m) => m.type === 'subscribe')).toHaveLength(1)
		expect(ctx.client.countSubscribedTo('peer')).toBe(1)

		ctx.client.removeTarget('c1')
		expect(ctx.sent.filter((m) => m.type === 'unsubscribe')).toHaveLength(0)

		// Let go of straight away once no button shows it
		ctx.client.removeTarget('c2')
		expect(ctx.client.countSubscribedTo('peer')).toBe(0)
		expect(ctx.sent.at(-1)).toMatchObject({ type: 'unsubscribe', payload: { buttons: [sub] } })
	})

	test('a new render is held back until it has arrived at every size, so that they change together', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		const onChange = show('c1', [square, wide])
		await vi.advanceTimersByTimeAsync(0)

		ctx.client.handleUpdate('peer', update(['peer'], revision, true, sub))
		expect(ctx.client.getState('c1')?.status).toBe('loading')

		ctx.client.handleUpdate('peer', update(['peer'], revision, true, wideSub))
		expect(ctx.client.getState('c1')?.images.map((i) => [i.width, i.current])).toEqual([
			[288, true],
			[144, true],
		])
		onChange.mockClear()

		// A size that is slow to arrive holds it back only briefly
		const next = { stream: 's1', seq: 2 }
		ctx.client.handleUpdate('peer', update(['peer'], next, false, sub))
		expect(ctx.client.getState('c1')?.pressed).toBe(true)
		expect(onChange).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(linkCoalesceWaitMs(null))
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(ctx.client.getState('c1')).toMatchObject({ pressed: false })
		expect(ctx.client.getState('c1')?.images.map((i) => [i.width, i.revision.seq, i.current])).toEqual([
			[288, 1, false],
			[144, 2, true],
		])
	})

	test('the image to draw at a size is of its shape, waiting briefly for one just subscribed to', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1', [square])
		await vi.advanceTimersByTimeAsync(0)
		ctx.client.handleUpdate('peer', update(['peer']))

		// As the graphics fetch them for the remote element, by the remote button of the link button
		const remoteKey = ctx.client.getState('c1')!.remoteKey!
		const imageAt = async (size: { width: number; height: number }) =>
			(await ctx.images.getImage(remoteKey, size))?.dataUrl.replace('data:image/png;base64,', '')

		// Here already
		expect(await imageAt(square)).toBe('144x144-1')
		// Nothing of this shape is subscribed to, so there is nothing to wait for: the closest shape
		expect(await imageAt(wide)).toBe('144x144-1')
		// Identified by the remote button, size and revision, so that the image data is never compared
		expect(await ctx.images.getImage(remoteKey, square)).toMatchObject({ key: 'peer/location/1/0/2/0x0@144x144#s1:1' })

		// Just shown as a strip: its first image is waited for, rather than drawing the square first
		ctx.client.setDisplayedSizes('c1', [square, wide])
		const waiting = imageAt(wide)
		ctx.client.handleUpdate('peer', update(['peer'], revision, true, wideSub))
		expect(await waiting).toBe('288x144-1')

		// One that doesn't arrive in time is drawn from the closest shape
		const tall = { width: 100, height: 200 }
		ctx.client.setDisplayedSizes('c1', [square, wide, tall])
		const late = imageAt(tall)
		await vi.advanceTimersByTimeAsync(linkImageWaitMs(null))
		expect(await late).toBe('144x144-1')

		expect(await ctx.images.getImage('unknown', square)).toBeNull()

		// Gone once nothing shows it
		ctx.client.removeTarget('c1')
		expect(await ctx.images.getImage(remoteKey, square)).toBeNull()
	})

	test('waits less for a peer with a measured latency', () => {
		expect(linkImageWaitMs(5)).toBe(35)
		expect(linkImageWaitMs(0)).toBe(30)
		expect(linkImageWaitMs(1000)).toBe(300)
		expect(linkCoalesceWaitMs(5)).toBe(25)
		expect(linkCoalesceWaitMs(1000)).toBe(100)
	})

	test('detects loops', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		ctx.client.handleUpdate('peer', update(['self', 'peer']))

		expect(ctx.client.getState('c1')?.status).toBe('loop')
	})

	test('keeps showing the last image briefly when a peer drops out, then shows it offline', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		await vi.advanceTimersByTimeAsync(0)
		ctx.client.handleUpdate('peer', update(['peer']))

		expect(ctx.client.getState('c1')?.unreachable).toBe(false)
		ctx.peers.handleTransportDisconnected('t1')
		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', unreachable: true })

		await vi.advanceTimersByTimeAsync(LINK_UNREACHABLE_GRACE_MS)
		expect(ctx.client.getState('c1')?.status).toBe('offline')

		// Back again: it says what it has, to be sent anything it missed
		ctx.sent.length = 0
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		expect(ctx.client.getState('c1')?.status).toBe('ok')
		expect(ctx.sent).toMatchObject([{ type: 'subscribe', payload: { buttons: [{ have: revision }] } }])
	})

	test('a brief drop keeps showing the button, marked as unreachable until it is back', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		const onChange = show('c1')
		await vi.advanceTimersByTimeAsync(0)
		ctx.client.handleUpdate('peer', update(['peer']))
		onChange.mockClear()

		ctx.peers.handleTransportDisconnected('t1')
		await vi.advanceTimersByTimeAsync(1000)
		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', unreachable: true })
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		await vi.advanceTimersByTimeAsync(LINK_UNREACHABLE_GRACE_MS)

		expect(ctx.client.getState('c1')).toMatchObject({ status: 'ok', unreachable: false })
		// Only marked and unmarked, never shown as offline
		expect(onChange).toHaveBeenCalledTimes(2)
	})

	test('a peer that dropped out before the button was made is shown offline once the grace period is over', async () => {
		vi.useFakeTimers()
		ctx = createClient()
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleTransportDisconnected('t1')
		show('c1')
		expect(ctx.client.getState('c1')?.status).toBe('loading')

		await vi.advanceTimersByTimeAsync(LINK_UNREACHABLE_GRACE_MS)
		expect(ctx.client.getState('c1')?.status).toBe('offline')
	})

	test('a peer that does not share its buttons is reported, and not asked for them', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		ctx.peers.handleAccess('peer', { buttons: false })
		expect(ctx.client.getState('c1')?.status).toBe('denied')
		await flushSubscribes()

		ctx.sent.length = 0
		ctx.client.press('c1', true, 'deck')
		ctx.client.renewAll()
		expect(ctx.sent).toEqual([])
	})

	test('subscribes again when a peer starts sharing its buttons', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAccess('peer', { buttons: false })
		show('c1')
		await flushSubscribes()
		ctx.sent.length = 0

		ctx.peers.handleAccess('peer', { buttons: true })
		expect(ctx.sent).toMatchObject([{ transportId: 't1', type: 'subscribe', payload: { buttons: [{ have: null }] } }])
		expect(ctx.client.getState('c1')?.status).toBe('loading')
	})

	test('reports incompatible peers', () => {
		show('c1')

		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer', ['2.0.0']), 0)
		expect(ctx.client.getState('c1')?.status).toBe('incompatible')
	})

	test('does not send to an incompatible peer', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer', ['2.0.0']), 0)
		show('c1')
		ctx.client.press('c1', true, 'deck')
		await flushSubscribes()
		expect(ctx.sent).toEqual([])
	})

	test('sends everything over the route to the peer only', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', 'peer', announcement('peer'), 10)
		show('c1')
		await flushSubscribes()
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

	test('sends aborts to the remote button', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		await flushSubscribes()
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

	test('renews subscriptions saying which revision it has of each size', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1', [square, wide])
		await flushSubscribes()
		ctx.sent.length = 0

		ctx.client.handleUpdate('peer', update(['peer']))
		ctx.client.renewAll()
		expect(ctx.sent.map((m) => m.payload.buttons.map((b: any) => [b.width, b.have]))).toEqual([
			[
				[288, null],
				[144, revision],
			],
		])
	})

	test('says why a button is refused, until an update says it is served after all', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')

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

	test('a size that is refused does not hold back the others', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1', [square, wide])

		ctx.client.handleRefused('peer', { buttons: [{ ...wideSub, reason: 'limit' }] })
		ctx.client.handleUpdate('peer', update(['peer']))
		expect(ctx.client.getState('c1')?.status).toBe('ok')
	})

	test('keeps the newest update, whatever order they arrive in', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')

		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's1', seq: 2 }, true))
		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's1', seq: 1 }, false))
		expect(ctx.client.getState('c1')?.pressed).toBe(true)

		// A new stream, eg the peer restarted, replaces it
		ctx.client.handleUpdate('peer', update(['peer'], { stream: 's2', seq: 0 }, false))
		expect(ctx.client.getState('c1')?.pressed).toBe(false)
	})

	test('moves to another route when the current one stops reaching the peer, saying what it has', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		ctx.peers.handleAnnouncement('t2', 'peer', announcement('peer'), 0)
		show('c1')
		await flushSubscribes()
		ctx.client.handleUpdate('peer', update(['peer']))
		ctx.sent.length = 0

		ctx.peers.handleTransportDisconnected('t1')
		expect(ctx.sent.map((m) => [m.transportId, m.type, m.payload.buttons[0].have])).toEqual([
			['t2', 'subscribe', revision],
		])
	})

	test('changing the target moves the subscriptions', async () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')
		await flushSubscribes()
		ctx.sent.length = 0
		ctx.client.setTarget('c1', { peerId: 'peer', location: { ...location, column: 3 } }, vi.fn())
		await flushSubscribes()

		expect(ctx.sent.map((m) => [m.type, m.payload.buttons[0].button.column, m.payload.buttons[0].width])).toEqual([
			['unsubscribe', 2, 144],
			['subscribe', 3, 144],
		])
	})

	test('only accepts updates for a button and size subscribed to, from the peer that sent it', () => {
		ctx.peers.handleAnnouncement('t1', 'peer', announcement('peer'), 0)
		show('c1')

		ctx.client.handleUpdate('someone-else', update(['someone-else']))
		ctx.client.handleUpdate('peer', { ...update(['peer']), width: 72, height: 72 })
		ctx.client.handleUpdate('peer', { ...update(['peer']), button: { ...button, column: 3 } })
		expect(ctx.client.getState('c1')?.status).toBe('loading')

		ctx.client.handleUpdate('peer', update(['peer']))
		expect(ctx.client.getState('c1')?.status).toBe('ok')
	})
})

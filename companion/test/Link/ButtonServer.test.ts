import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../../lib/Graphics/ImageResult.js'
import { LinkButtonServer, type LinkButtonServerHost } from '../../lib/Link/ButtonServer.js'
import { decodeLinkMessage, type LinkButtonRevision } from '../../lib/Link/Protocol/v1/Schemas.js'
import { LINK_SUBSCRIPTION_LEASE_MS } from '../../lib/Link/Protocol/v1/Timing.js'

const button = { type: 'location', page: 1, row: 0, column: 2 } as const
const sub = { button, width: 72, height: 72 }

/** Subscribe to `sub`, holding a revision of it */
function subscribe(have: LinkButtonRevision | null) {
	return { ...sub, have }
}

let ids = 0
/** A new id for a press or rotation */
function nextId(): string {
	return `id${++ids}`
}

function messageOf(payload: string) {
	const decoded = decodeLinkMessage(payload)
	return decoded.ok ? decoded.message : null
}

function revisionOf(payload: string): LinkButtonRevision {
	const decoded = decodeLinkMessage(payload)
	if (!decoded.ok || decoded.message.type !== 'button.update') throw new Error('Not an update')
	return decoded.message.payload.revision
}

function fakeRender(pushed: boolean): ImageResult {
	return {
		style: { type: 'button', state: { pushed } },
		drawNativeEncoded: vi.fn(async () => 'data:image/png;base64,AAAA'),
	} as unknown as ImageResult
}

function createServer() {
	const sent: { transportId: string; peerId: string; payload: string }[] = []
	const host = {
		getCachedRenderOrGeneratePlaceholder: vi.fn((_location: ControlLocation) => fakeRender(false)),
		getControlIdAt: vi.fn((location: ControlLocation): string | null => `control${location.column}`),
		pressControl: vi.fn(() => true),
		rotateControl: vi.fn(() => true),
		abortControl: vi.fn(),
		getSourceChain: vi.fn((_location: ControlLocation): string[] => []),
		send: (transportId: string, peerId: string, payload: string) => sent.push({ transportId, peerId, payload }),
		getClockOffset: vi.fn((_peerId: string): number | null => null),
	} satisfies LinkButtonServerHost
	const server = new LinkButtonServer(host, () => 'self')
	return { server, host, sent }
}

async function flush(): Promise<void> {
	// Let the render queue run
	for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
}

describe('LinkButtonServer', () => {
	let ctx: ReturnType<typeof createServer>
	beforeEach(() => {
		ctx = createServer()
	})

	test('renders once, and sends to each subscriber over the transport its lease came on', async () => {
		ctx.server.handleSubscribe('a', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handleSubscribe('b', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handleSubscribe('c', 't2', { buttons: [subscribe(null)] }, 0)
		await flush()
		ctx.sent.length = 0

		const render = fakeRender(true)
		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 2 }, render)
		await flush()
		expect(render.drawNativeEncoded).toHaveBeenCalledTimes(1)
		expect(ctx.sent.map((p) => [p.peerId, p.transportId])).toEqual([
			['a', 't1'],
			['b', 't1'],
			['c', 't2'],
		])

		// A subscriber that now reaches us another way is sent its updates there, and no longer the old way
		ctx.server.handleSubscribe('c', 't1', { buttons: [subscribe(revisionOf(ctx.sent[2].payload))] }, 1000)
		await flush()
		ctx.sent.length = 0
		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 2 }, fakeRender(true))
		await flush()
		expect(ctx.sent.find((p) => p.peerId === 'c')?.transportId).toBe('t1')
	})

	test('sends the current state to a new subscriber', async () => {
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		await flush()

		expect(ctx.sent).toHaveLength(1)
		expect(ctx.sent[0].peerId).toBe('peer')
		const decoded = decodeLinkMessage(ctx.sent[0].payload)
		expect(decoded).toMatchObject({
			ok: true,
			message: { type: 'button.update', payload: { ...sub, pressed: false, sourceChain: ['self'] } },
		})
	})

	test('sends the latest update to a subscriber that does not have it, and not again to one that does', async () => {
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		await flush()
		expect(ctx.sent).toHaveLength(1)
		const revision = revisionOf(ctx.sent[0].payload)

		// A renewal holding it
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(revision)] }, 1000)
		await flush()
		expect(ctx.sent).toHaveLength(1)

		// A renewal that missed it, or holds one from before the peer restarted, is sent it again, without rendering
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 2000)
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe({ stream: 'old', seq: 5 })] }, 3000)
		await flush()
		expect(ctx.sent.map((p) => p.payload)).toEqual([ctx.sent[0].payload, ctx.sent[0].payload, ctx.sent[0].payload])
		expect(ctx.host.getCachedRenderOrGeneratePlaceholder).toHaveBeenCalledTimes(1)
	})

	test('numbers each update of a button, in a stream of its own each time it is served', async () => {
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		await flush()
		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 2 }, fakeRender(true))
		await flush()

		const [first, second] = ctx.sent.map((p) => revisionOf(p.payload))
		expect(second).toEqual({ stream: first.stream, seq: first.seq + 1 })

		// Served again from scratch, so a subscriber can't mistake the new updates for old ones
		ctx.server.handleUnsubscribe('peer', { buttons: [sub] })
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(second)] }, 1000)
		await flush()
		expect(revisionOf(ctx.sent[2].payload).stream).not.toBe(first.stream)
	})

	test('sends redraws of subscribed buttons only', async () => {
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		await flush()

		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 2 }, fakeRender(true))
		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 3 }, fakeRender(true))
		await flush()

		expect(ctx.sent).toHaveLength(2)
		expect(decodeLinkMessage(ctx.sent[1].payload)).toMatchObject({ message: { payload: { pressed: true } } })
	})

	test('refuses buttons beyond how many it can serve, saying why', async () => {
		const many = Array.from({ length: 5001 }, (_, column) => ({
			button: { ...button, column },
			width: 72,
			height: 72,
			have: null,
		}))
		ctx.server.handleSubscribe('peer', 't1', { buttons: many }, 0)
		await flush()

		const refusals = ctx.sent.map((p) => messageOf(p.payload)).filter((m) => m?.type === 'subscribe.refused')
		expect(refusals.map((m) => m?.payload)).toEqual([
			{ buttons: [{ button: { ...button, column: 5000 }, width: 72, height: 72, reason: 'limit' }] },
		])
	})

	test('refuses every button of a subscribe when asked to', () => {
		ctx.server.refuseSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 'denied')
		expect(ctx.sent.map((p) => [p.peerId, p.transportId, decodeLinkMessage(p.payload)])).toEqual([
			[
				'peer',
				't1',
				{ ok: true, message: { type: 'subscribe.refused', payload: { buttons: [{ ...sub, reason: 'denied' }] } } },
			],
		])
		expect(ctx.server.servedCount).toBe(0)
	})

	test('counts the buttons each peer is subscribed to', () => {
		const other = { button: { ...button, column: 3 }, width: 72, height: 72 }
		ctx.server.handleSubscribe('a', 't1', { buttons: [subscribe(null), { ...other, have: null }] }, 0)
		ctx.server.handleSubscribe('b', 't1', { buttons: [subscribe(null)] }, 0)

		expect(ctx.server.countSubscribedBy('a')).toBe(2)
		expect(ctx.server.countSubscribedBy('b')).toBe(1)
		expect(ctx.server.countSubscribedBy('c')).toBe(0)

		ctx.server.handleUnsubscribe('a', { buttons: [other] })
		expect(ctx.server.countSubscribedBy('a')).toBe(1)
	})

	test('keeps a button served until the last subscriber leaves', () => {
		ctx.server.handleSubscribe('a', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handleSubscribe('b', 't1', { buttons: [subscribe(null)] }, 0)
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.handleUnsubscribe('a', { buttons: [sub] })
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.handleUnsubscribe('b', { buttons: [sub] })
		expect(ctx.server.servedCount).toBe(0)
	})

	test('expires leases that are not renewed', () => {
		ctx.server.handleSubscribe('a', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handleSubscribe('b', 't1', { buttons: [subscribe(null)] }, 30_000)

		ctx.server.expireLeases(LINK_SUBSCRIPTION_LEASE_MS)
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.expireLeases(30_000 + LINK_SUBSCRIPTION_LEASE_MS)
		expect(ctx.server.servedCount).toBe(0)
	})

	test('includes the source chain of a linked button', async () => {
		ctx.host.getSourceChain.mockReturnValue(['other'])
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		await flush()

		expect(decodeLinkMessage(ctx.sent[0].payload)).toMatchObject({
			message: { payload: { sourceChain: ['other', 'self'] } },
		})
	})

	test('presses with a surface id namespaced by the source', () => {
		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 1000, button, pressed: true, surfaceId: 'deck' }, 0)
		expect(ctx.host.pressControl).toHaveBeenCalledWith('control2', true, 'link:peer:deck')
	})

	test('drops presses that have been forwarded too many times', () => {
		const surfaceId = 'deck' + '#ref#x'.repeat(10)
		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 1000, button, pressed: true, surfaceId }, 0)
		expect(ctx.host.pressControl).not.toHaveBeenCalled()
	})

	test('revoking a peer stops serving it and releases what it still holds', () => {
		ctx.server.handleSubscribe('peer', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handleSubscribe('other', 't1', { buttons: [subscribe(null)] }, 0)
		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 1000, button, pressed: true, surfaceId: 'deck' }, 0)
		const column3 = { ...button, column: 3 }
		ctx.server.handlePress(
			'peer',
			{ id: nextId(), expiresAt: 1000, button: column3, pressed: true, surfaceId: 'deck' },
			0
		)
		ctx.server.handlePress(
			'peer',
			{ id: nextId(), expiresAt: 1000, button: column3, pressed: false, surfaceId: 'deck' },
			0
		)
		ctx.host.pressControl.mockClear()

		ctx.server.revoke('peer')
		expect(ctx.host.pressControl.mock.calls).toEqual([['control2', false, 'link:peer:deck']])
		expect(ctx.server.servedCount).toBe(1)

		ctx.host.pressControl.mockClear()
		ctx.server.revoke('peer')
		expect(ctx.host.pressControl).not.toHaveBeenCalled()

		ctx.server.revoke('other')
		expect(ctx.server.servedCount).toBe(0)
	})

	test('acts on each press and rotation once, as a copy may arrive over each transport', () => {
		const press = { id: nextId(), expiresAt: 1000, button, pressed: true, surfaceId: 'deck' }
		ctx.server.handlePress('peer', press, 0)
		ctx.server.handlePress('peer', press, 0)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(1)

		// Ids are per sender
		ctx.server.handlePress('other', press, 0)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(2)

		const rotate = { id: nextId(), expiresAt: 1000, button, delta: 1, surfaceId: 'deck' }
		ctx.server.handleRotate('peer', rotate, 0)
		ctx.server.handleRotate('peer', rotate, 0)
		expect(ctx.host.rotateControl).toHaveBeenCalledTimes(1)

		const abort = { id: nextId(), expiresAt: 1000, button, unlatch: false, hops: 0 }
		ctx.server.handleAbort('peer', abort, 0)
		ctx.server.handleAbort('peer', abort, 0)
		expect(ctx.host.abortControl).toHaveBeenCalledTimes(1)
	})

	test('drops a press, release or rotation that arrives once it has expired, by the clock of its sender', () => {
		// The peer's clock is 5s ahead of ours
		ctx.host.getClockOffset.mockReturnValue(5000)

		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 7000, button, pressed: true, surfaceId: 'deck' }, 2000)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(1)

		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 7000, button, pressed: true, surfaceId: 'deck' }, 2001)
		ctx.server.handleRotate('peer', { id: nextId(), expiresAt: 7000, button, delta: 1, surfaceId: 'deck' }, 2001)
		ctx.server.handleAbort('peer', { id: nextId(), expiresAt: 7000, button, unlatch: false, hops: 0 }, 2001)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(1)
		expect(ctx.host.rotateControl).not.toHaveBeenCalled()
		expect(ctx.host.abortControl).not.toHaveBeenCalled()

		// A release too, leaving the button held, as when a surface is unplugged mid-press
		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 7000, button, pressed: false, surfaceId: 'deck' }, 9000)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(1)
	})

	test('acts on presses whatever their expiry until the clock of the sender has been measured', () => {
		ctx.server.handlePress('peer', { id: nextId(), expiresAt: 0, button, pressed: true, surfaceId: 'deck' }, 1_000_000)
		expect(ctx.host.pressControl).toHaveBeenCalledTimes(1)
	})

	test('rotates', () => {
		ctx.server.handleRotate('peer', { id: nextId(), expiresAt: 1000, button, delta: -2, surfaceId: 'deck' }, 0)
		expect(ctx.host.rotateControl).toHaveBeenCalledWith('control2', -2, 'link:peer:deck')
	})

	test('aborts, counting the hop so that a loop of link buttons ends', () => {
		ctx.server.handleAbort('peer', { id: nextId(), expiresAt: 1000, button, unlatch: true, hops: 2 }, 0)
		expect(ctx.host.abortControl).toHaveBeenCalledWith('control2', true, 3)

		ctx.server.handleAbort('peer', { id: nextId(), expiresAt: 1000, button, unlatch: true, hops: 100 }, 0)
		expect(ctx.host.abortControl).toHaveBeenCalledTimes(1)
	})
})

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../../lib/Graphics/ImageResult.js'
import { LinkButtonServer, type LinkButtonServerHost } from '../../lib/Link/ButtonServer.js'
import { decodeLinkMessage } from '../../lib/Link/Protocol/Schemas.js'
import { LINK_SUBSCRIPTION_LEASE_MS, linkButtonUpdateTopic } from '../../lib/Link/Protocol/Topics.js'

const sub = { page: 1, row: 0, column: 2, width: 72, height: 72 }
const topic = linkButtonUpdateTopic('self', sub)

function fakeRender(pushed: boolean): ImageResult {
	return {
		style: { type: 'button', state: { pushed } },
		drawNativeEncoded: vi.fn(async () => 'data:image/png;base64,AAAA'),
	} as unknown as ImageResult
}

function createServer() {
	const published: { topic: string; payload: string }[] = []
	const host = {
		getCachedRenderOrGeneratePlaceholder: vi.fn((_location: ControlLocation) => fakeRender(false)),
		getControlIdAt: vi.fn((location: ControlLocation): string | null => `control${location.column}`),
		pressControl: vi.fn(() => true),
		rotateControl: vi.fn(() => true),
		getSourceChain: vi.fn((_location: ControlLocation): string[] => []),
		publish: (topic: string, payload: string) => published.push({ topic, payload }),
	} satisfies LinkButtonServerHost
	const server = new LinkButtonServer(host, () => 'self')
	return { server, host, published }
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

	test('sends the current state to a new subscriber', async () => {
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 0)
		await flush()

		expect(ctx.published).toHaveLength(1)
		expect(ctx.published[0].topic).toBe(topic)
		const decoded = decodeLinkMessage(ctx.published[0].payload)
		expect(decoded).toMatchObject({
			ok: true,
			message: { type: 'button.update', payload: { ...sub, pressed: false, sourceChain: ['self'] } },
		})
	})

	test('does not resend for a renewal, unless asked to', async () => {
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 0)
		await flush()
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 1000)
		await flush()
		expect(ctx.published).toHaveLength(1)

		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: true }, 2000)
		await flush()
		expect(ctx.published).toHaveLength(2)
	})

	test('publishes redraws of subscribed buttons only', async () => {
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 0)
		await flush()

		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 2 }, fakeRender(true))
		ctx.server.onButtonDrawn({ pageNumber: 1, row: 0, column: 3 }, fakeRender(true))
		await flush()

		expect(ctx.published).toHaveLength(2)
		expect(decodeLinkMessage(ctx.published[1].payload)).toMatchObject({ message: { payload: { pressed: true } } })
	})

	test('keeps a button served until the last subscriber leaves', () => {
		ctx.server.handleSubscribe({ requestorId: 'a', buttons: [sub], sendCurrent: false }, 0)
		ctx.server.handleSubscribe({ requestorId: 'b', buttons: [sub], sendCurrent: false }, 0)
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.handleUnsubscribe({ requestorId: 'a', buttons: [sub] })
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.handleUnsubscribe({ requestorId: 'b', buttons: [sub] })
		expect(ctx.server.servedCount).toBe(0)
	})

	test('expires leases that are not renewed', () => {
		ctx.server.handleSubscribe({ requestorId: 'a', buttons: [sub], sendCurrent: false }, 0)
		ctx.server.handleSubscribe({ requestorId: 'b', buttons: [sub], sendCurrent: false }, 30_000)

		ctx.server.expireLeases(LINK_SUBSCRIPTION_LEASE_MS)
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.expireLeases(30_000 + LINK_SUBSCRIPTION_LEASE_MS)
		expect(ctx.server.servedCount).toBe(0)
	})

	test('includes the source chain of a linked button', async () => {
		ctx.host.getSourceChain.mockReturnValue(['other'])
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 0)
		await flush()

		expect(decodeLinkMessage(ctx.published[0].payload)).toMatchObject({
			message: { payload: { sourceChain: ['other', 'self'] } },
		})
	})

	test('presses with a surface id namespaced by the source', () => {
		ctx.server.handlePress({ page: 1, row: 0, column: 2, sourceId: 'peer', pressed: true, surfaceId: 'deck' })
		expect(ctx.host.pressControl).toHaveBeenCalledWith('control2', true, 'link:peer:deck')
	})

	test('drops presses that have been forwarded too many times', () => {
		const surfaceId = 'deck' + '#ref#x'.repeat(10)
		ctx.server.handlePress({ page: 1, row: 0, column: 2, sourceId: 'peer', pressed: true, surfaceId })
		expect(ctx.host.pressControl).not.toHaveBeenCalled()
	})

	test('releases buttons held by a peer that becomes unreachable', () => {
		ctx.server.handlePress({ page: 1, row: 0, column: 2, sourceId: 'peer', pressed: true, surfaceId: 'deck' })
		ctx.server.handlePress({ page: 1, row: 0, column: 3, sourceId: 'peer', pressed: true, surfaceId: 'deck' })
		ctx.server.handlePress({ page: 1, row: 0, column: 3, sourceId: 'peer', pressed: false, surfaceId: 'deck' })
		ctx.host.pressControl.mockClear()

		ctx.server.releaseHeldBy('other')
		expect(ctx.host.pressControl).not.toHaveBeenCalled()

		// Only the one still held is released
		ctx.server.releaseHeldBy('peer')
		expect(ctx.host.pressControl.mock.calls).toEqual([['control2', false, 'link:peer:deck']])

		ctx.host.pressControl.mockClear()
		ctx.server.releaseHeldBy('peer')
		expect(ctx.host.pressControl).not.toHaveBeenCalled()
	})

	test('revoking a peer stops serving it and releases what it held', () => {
		ctx.server.handleSubscribe({ requestorId: 'peer', buttons: [sub], sendCurrent: false }, 0)
		ctx.server.handleSubscribe({ requestorId: 'other', buttons: [sub], sendCurrent: false }, 0)
		ctx.server.handlePress({ page: 1, row: 0, column: 2, sourceId: 'peer', pressed: true, surfaceId: 'deck' })
		ctx.host.pressControl.mockClear()

		ctx.server.revoke('peer')
		expect(ctx.host.pressControl.mock.calls).toEqual([['control2', false, 'link:peer:deck']])
		expect(ctx.server.servedCount).toBe(1)

		ctx.server.revoke('other')
		expect(ctx.server.servedCount).toBe(0)
	})

	test('rotates', () => {
		ctx.server.handleRotate({ page: 1, row: 0, column: 2, sourceId: 'peer', delta: -2, surfaceId: 'deck' })
		expect(ctx.host.rotateControl).toHaveBeenCalledWith('control2', -2, 'link:peer:deck')
	})
})

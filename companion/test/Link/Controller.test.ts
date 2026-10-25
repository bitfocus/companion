import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportConfig } from '@companion-app/shared/Model/Link.js'
import type { IControlStore } from '../../lib/Controls/IControlStore.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { GraphicsController } from '../../lib/Graphics/Controller.js'
import { DisplayedLocations } from '../../lib/Graphics/DisplayedLocations.js'
import type { ImageResult } from '../../lib/Graphics/ImageResult.js'
import { LinkController } from '../../lib/Link/Controller.js'
import {
	decodeLinkAnnouncement,
	encodeLinkAnnouncement,
	LINK_ANNOUNCE_INTERVAL_MS,
	LINK_ANNOUNCE_MISSED_LIMIT,
} from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage, type LinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { LinkRemoteImageStore } from '../../lib/Link/RemoteImageStore.js'
import type {
	LinkMessageOrigin,
	LinkTransport,
	LinkTransportContext,
	LinkTransportDefinition,
} from '../../lib/Link/Transports/Types.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

class FakeTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly announced: (string | null)[] = []
	readonly sent: { peerId: string; message: LinkMessage | null }[] = []

	constructor(context: LinkTransportContext) {
		this.context = context
	}
	announce(payload: string | null): void {
		this.announced.push(payload)
	}
	send(peerId: string, payload: string): void {
		const decoded = decodeLinkMessage(payload)
		this.sent.push({ peerId, message: decoded.ok ? decoded.message : null })
	}
	async handleSectionAction(): Promise<string | null> {
		return null
	}
	/** Resolved when it has finished being destroyed, so a test can hold it up */
	destroying = Promise.resolve()
	async destroy(): Promise<void> {
		await this.destroying
	}

	messagesOfType(type: LinkMessage['type']) {
		return this.sent.filter((p) => p.message?.type === type)
	}
}

const fromPeer: LinkMessageOrigin = { peerId: 'peer' }
const button = { type: 'location', page: 1, row: 0, column: 0 } as const

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
}

/** A controller with one transport, connected, on a database that can be reused to restart it */
function createController(db = new FakeDataDatabase(), installName = 'Self') {
	db.getTableView('link_transports').data.t1 = {
		id: 't1',
		type: 'fake',
		label: 'Fake',
		enabled: true,
		config: {},
		sortOrder: 0,
		builtin: false,
	} satisfies LinkTransportConfig

	const instances: FakeTransport[] = []
	const definition: LinkTransportDefinition<Record<string, never>> = {
		type: 'fake',
		name: 'Fake',
		description: 'Fake',
		configFields: [],
		bonjourQueries: { host: { type: 'fake-service', protocol: 'tcp' } },
		create: (context) => {
			const instance = new FakeTransport(context)
			instances.push(instance)
			return instance
		},
	}

	const userconfig = {
		getKey: () => installName,
		on: vi.fn(),
	} as unknown as DataUserConfig
	const pageStore = Object.assign(new EventEmitter(), {
		getControlIdAt: () => 'control1',
	}) as unknown as IPageStore

	const abortControl = vi.fn()
	const controls = {
		pressControl: vi.fn(() => true),
		rotateControl: vi.fn(() => true),
		getControl: vi.fn(() => ({ abortDelayedActions: abortControl }) as any),
	}
	const graphics = {
		displayedLocations: new DisplayedLocations(),
		getUndecoratedRender: vi.fn((render: ImageResult) => ({ render, contentKey: null, state: null })),
		getContentSize: vi.fn((size: { width: number; height: number }) => size),
		getCachedRenderOrGeneratePlaceholder: vi.fn(
			() =>
				({
					style: { type: 'button', state: { pushed: false } },
					drawNativeEncoded: async () => 'data:image/png;base64,AAAA',
				}) as unknown as ImageResult
		),
	}

	const controller = new LinkController(
		{ appVersion: '5.0.0' } as any,
		db.asDataDatabase(),
		userconfig,
		// Only what Link uses
		{
			pageStore,
			controls: controls as unknown as IControlStore,
			graphics: graphics as unknown as GraphicsController,
			remoteImages: new LinkRemoteImageStore(),
		},
		[definition],
		[]
	)

	controller.start()

	/** The running instance of the transport, which is replaced when it is restarted */
	const transport = () => instances[instances.length - 1]
	transport().context.setStatus('connected', null)

	function announcePeer(protocolVersions = ['1.0.0']) {
		transport().context.receiveAnnouncement(
			'peer',
			encodeLinkAnnouncement({ name: 'Peer', companionVersion: '5.0.0', protocolVersions, announceIntervalMs: 15_000 })
		)
	}

	function sendToSelf(origin: LinkMessageOrigin, message: string) {
		transport().context.receive(message, origin)
	}

	async function shareButtons(buttons: boolean) {
		await controller
			.createTrpcRouter()
			.createCaller({} as any)
			.setPeerPermissions({ peerId: 'peer', permissions: { buttons } })
	}

	return { db, controller, instances, controls, abortControl, transport, announcePeer, sendToSelf, shareButtons }
}

describe('LinkController', () => {
	let ctx: ReturnType<typeof createController>
	beforeEach(() => {
		ctx = createController()
	})
	afterEach(async () => {
		await ctx.controller.stop()
	})

	test('announces itself, with a Link id it keeps across restarts', async () => {
		expect(ctx.transport().announced).toHaveLength(1)
		expect(ctx.transport().announced[0]).not.toBeNull()

		const id = ctx.transport().context.identity.id
		await ctx.controller.stop()
		ctx = createController(ctx.db)
		expect(ctx.transport().context.identity.id).toBe(id)
	})

	test('shortens a long name to what other installations accept', async () => {
		await ctx.controller.stop()
		ctx = createController(new FakeDataDatabase(), 'x'.repeat(300))

		const announced = decodeLinkAnnouncement(ctx.transport().announced[0] ?? '')
		expect(announced.ok && announced.announcement.name).toBe('x'.repeat(200))
		expect(ctx.transport().context.getName()).toBe('x'.repeat(200))
	})

	test('says goodbye when it stops', async () => {
		const transport = ctx.transport()
		await ctx.controller.stop()
		expect(transport.announced.at(-1)).toBeNull()
	})

	test('regenerating the id says goodbye as the old one, and announces as the new one', async () => {
		const before = ctx.transport()
		const oldId = before.context.identity.id

		await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any)
			.regenerateId()
		expect(before.announced.at(-1)).toBeNull()

		const after = ctx.transport()
		expect(after.context.identity.id).not.toBe(oldId)
		after.context.setStatus('connected', null)
		expect(after.announced.at(-1)).not.toBeNull()
	})

	test('an id regeneration in progress when Link stops does not start the transports again', async () => {
		const oldIdentity = ctx.db.getTableView('link').data.identity
		let finishDestroying = () => {}
		ctx.transport().destroying = new Promise((resolve) => {
			finishDestroying = resolve
		})

		const regenerating = ctx.controller
			.createTrpcRouter()
			.createCaller({} as any)
			.regenerateId()
		// The regeneration is waiting for the transports to stop when Link stops
		await new Promise((resolve) => setImmediate(resolve))
		const stopping = ctx.controller.stop()
		finishDestroying()
		await stopping
		// Its new identity is saved before stop returns, as the database may be closed after it
		expect(ctx.db.getTableView('link').data.identity).not.toBe(oldIdentity)
		await regenerating

		expect(ctx.instances).toHaveLength(1)
	})

	test('id regenerations run one at a time, each restarting the transports with its own id', async () => {
		const caller = ctx.controller.createTrpcRouter().createCaller({} as any)
		await Promise.all([caller.regenerateId(), caller.regenerateId()])

		expect(ctx.instances).toHaveLength(3)
		const ids = ctx.instances.map((t) => t.context.identity.id)
		expect(new Set(ids).size).toBe(3)
	})

	test('tells a newly reachable peer what it may use, and again when that changes', async () => {
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('access')).toMatchObject([
			{ peerId: 'peer', message: { payload: { permissions: { buttons: false } } } },
		])

		await ctx.shareButtons(true)
		expect(ctx.transport().messagesOfType('access').at(-1)).toMatchObject({
			peerId: 'peer',
			message: { payload: { permissions: { buttons: true } } },
		})
	})

	test('warns when another installation announces with its Link id, but not for its own announcement', async () => {
		const self = async () => {
			const abort = new AbortController()
			try {
				const iterable = await ctx.controller
					.createTrpcRouter()
					.createCaller({} as any, { signal: abort.signal })
					.watchSelf()
				return (await iterable[Symbol.asyncIterator]().next()).value
			} finally {
				abort.abort()
			}
		}
		const selfId = ctx.transport().context.identity.id

		// Its own, eg reflected back by a transport
		const own = decodeLinkAnnouncement(ctx.transport().announced[0]!)
		if (!own.ok) throw new Error('Invalid announcement')
		ctx.transport().context.receiveAnnouncement(selfId, encodeLinkAnnouncement(own.announcement))
		expect((await self())?.sharesLinkId).toBe(false)

		ctx
			.transport()
			.context.receiveAnnouncement(selfId, encodeLinkAnnouncement({ ...own.announcement, instanceId: 'a-clone' }))
		expect((await self())?.sharesLinkId).toBe(true)

		const abort = new AbortController()
		const attention = await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any, { signal: abort.signal })
			.watchAttention()
		const first = await attention[Symbol.asyncIterator]().next()
		abort.abort()
		expect(first.value).toEqual(['This installation: Link id shared with another'])
	})

	test('stops warning that its Link id is shared once that is no longer seen, even if the wall clock steps back', async () => {
		await ctx.controller.stop()
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date', 'performance'] })
		try {
			ctx = createController()
			const sharesLinkId = async () => {
				const abort = new AbortController()
				try {
					const iterable = await ctx.controller
						.createTrpcRouter()
						.createCaller({} as any, { signal: abort.signal })
						.watchSelf()
					return (await iterable[Symbol.asyncIterator]().next()).value?.sharesLinkId
				} finally {
					abort.abort()
				}
			}
			const own = decodeLinkAnnouncement(ctx.transport().announced[0]!)
			if (!own.ok) throw new Error('Invalid announcement')
			ctx
				.transport()
				.context.receiveAnnouncement(
					ctx.transport().context.identity.id,
					encodeLinkAnnouncement({ ...own.announcement, instanceId: 'a-clone' })
				)
			expect(await sharesLinkId()).toBe(true)

			// Eg set back by NTP, once the clone has gone
			vi.setSystemTime(Date.now() - 24 * 60 * 60_000)
			await vi.advanceTimersByTimeAsync(LINK_ANNOUNCE_INTERVAL_MS * (LINK_ANNOUNCE_MISSED_LIMIT + 1))
			expect(await sharesLinkId()).toBe(false)
		} finally {
			vi.useRealTimers()
		}
	})

	test('tells each peer what it may use again every so often, in case that was lost', async () => {
		await ctx.controller.stop()
		vi.useFakeTimers()
		try {
			ctx = createController()
			ctx.announcePeer()
			expect(ctx.transport().messagesOfType('access')).toHaveLength(1)

			await vi.advanceTimersByTimeAsync(LINK_ANNOUNCE_INTERVAL_MS)
			expect(ctx.transport().messagesOfType('access')).toHaveLength(2)
		} finally {
			vi.useRealTimers()
		}
	})

	test('keeps a peer reachable when the wall clock is stepped, eg by NTP at boot', async () => {
		await ctx.controller.stop()
		vi.useFakeTimers()
		try {
			ctx = createController()
			ctx.announcePeer()
			vi.setSystemTime(Date.now() + 24 * 60 * 60_000)

			// Told again, as it is still reachable
			await vi.advanceTimersByTimeAsync(LINK_ANNOUNCE_INTERVAL_MS)
			expect(ctx.transport().messagesOfType('access')).toHaveLength(2)
		} finally {
			vi.useRealTimers()
		}
	})

	test('sends nothing to a peer it has no protocol version in common with, until it has one', async () => {
		ctx.announcePeer(['2.0.0'])
		await ctx.shareButtons(true)
		expect(ctx.transport().messagesOfType('access')).toEqual([])
		expect(ctx.transport().messagesOfType('ping')).toEqual([])

		// Updated, to a version in common
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('access')).toMatchObject([
			{ peerId: 'peer', message: { payload: { permissions: { buttons: true } } } },
		])
		expect(ctx.transport().messagesOfType('ping')).toMatchObject([{ peerId: 'peer' }])
	})

	test('forgetting a peer stops sharing with it, and is remembered across restarts', async () => {
		ctx.announcePeer()
		await ctx.shareButtons(true)

		await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any)
			.forgetPeer({ peerId: 'peer' })
		expect(ctx.transport().messagesOfType('access').at(-1)).toMatchObject({
			peerId: 'peer',
			message: { payload: { permissions: { buttons: false } } },
		})
		expect(ctx.db.getTableView('link_peers').data).toEqual({})

		// When it is rediscovered, nothing is shared with it until the user says so again
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('access').at(-1)).toMatchObject({
			message: { payload: { permissions: { buttons: false } } },
		})
	})

	test('lists the peers seen before a restart, with what is shared with them, keeping any it cannot read', async () => {
		ctx.announcePeer()
		await ctx.shareButtons(true)
		// Stored by a version that this one can't read
		ctx.db.getTableView('link_peers').data.later = { lastSeen: 'yesterday', sharedByUs: { buttons: true } }
		await ctx.controller.stop()

		ctx = createController(ctx.db)
		const abort = new AbortController()
		const updates = await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any, { signal: abort.signal })
			.watchPeers()
		const peers = (await updates[Symbol.asyncIterator]().next()).value
		abort.abort()
		expect(peers).toEqual([expect.objectContaining({ id: 'peer', online: false, sharedByUs: { buttons: true } })])
		expect(Object.keys(ctx.db.getTableView('link_peers').data)).toEqual(['peer', 'later'])
	})

	test('discovers what a transport field asks for, leaving out this installation', () => {
		expect(ctx.controller.getBonjourQueries('fake', 'host')).toEqual([
			{ type: 'fake-service', protocol: 'tcp', excludeTxt: { linkId: ctx.controller.id } },
		])
		expect(ctx.controller.getBonjourQueries('fake', 'other')).toBeNull()
		expect(ctx.controller.getBonjourQueries('unknown', 'host')).toBeNull()
	})

	test('lists what the transports say needs attention, for the navigation to count', async () => {
		ctx.transport().context.setSections([
			{
				id: 'pending',
				title: 'Pairing requests',
				description: null,
				attention: true,
				entries: [{ id: 'a', title: 'Studio', description: null, inputLabel: null, actions: [] }],
			},
			{ id: 'paired', title: 'Paired', description: null, attention: false, entries: [] },
		])

		const abort = new AbortController()
		const updates = await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any, { signal: abort.signal })
			.watchAttention()
		const first = await updates[Symbol.asyncIterator]().next()
		abort.abort()

		expect(first.value).toEqual(['Pairing requests: Studio'])
	})

	test('answers a ping with a pong, and pings a newly reachable peer', () => {
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('ping')).toMatchObject([{ peerId: 'peer' }])

		ctx.sendToSelf(fromPeer, encodeLinkMessage('ping', { nonce: 'abc' }))
		expect(ctx.transport().messagesOfType('pong')).toMatchObject([
			{ peerId: 'peer', message: { payload: { nonce: 'abc' } } },
		])
	})

	test('ignores messages from a peer until it has announced a protocol version in common', () => {
		const ping = encodeLinkMessage('ping', { nonce: 'abc' })
		ctx.sendToSelf(fromPeer, ping)
		expect(ctx.transport().messagesOfType('pong')).toEqual([])

		ctx.announcePeer(['2.0.0'])
		ctx.sendToSelf(fromPeer, ping)
		expect(ctx.transport().messagesOfType('pong')).toEqual([])

		ctx.announcePeer()
		ctx.sendToSelf(fromPeer, ping)
		expect(ctx.transport().messagesOfType('pong')).toHaveLength(1)
	})

	test('a goodbye makes the peer unreachable, so it is newly reachable when it next announces', () => {
		ctx.announcePeer()
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('access')).toHaveLength(1)

		ctx.transport().context.receiveAnnouncement('peer', null)
		ctx.announcePeer()
		expect(ctx.transport().messagesOfType('access')).toHaveLength(2)
	})
})

describe('LinkController buttons', () => {
	let ctx: ReturnType<typeof createController>
	beforeEach(() => {
		ctx = createController()
	})
	afterEach(async () => {
		await ctx.controller.stop()
	})

	test('ignores button requests from a peer that is not allowed them', async () => {
		ctx.announcePeer()
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('subscribe', {
				buttons: [{ button, width: 72, height: 72, have: null }],
			})
		)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.press', {
				id: 'm1',
				expiresAt: Date.now() + 10_000,
				button,
				pressed: true,
				surfaceId: 's',
			})
		)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.rotate', { id: 'm2', expiresAt: Date.now() + 10_000, button, delta: 1, surfaceId: 's' })
		)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.abort', { id: 'm3', expiresAt: Date.now() + 10_000, button, unlatch: false, hops: 0 })
		)
		await flush()

		expect(ctx.transport().messagesOfType('button.update')).toEqual([])
		expect(ctx.controls.pressControl).not.toHaveBeenCalled()
		expect(ctx.controls.rotateControl).not.toHaveBeenCalled()
		expect(ctx.abortControl).not.toHaveBeenCalled()

		// The subscriber is told why, rather than left waiting for the image
		expect(ctx.transport().messagesOfType('subscribe.refused')).toMatchObject([
			{ peerId: 'peer', message: { payload: { buttons: [{ button, width: 72, height: 72, reason: 'denied' }] } } },
		])
	})

	test('serves an allowed peer, sending it images of the buttons it subscribed to', async () => {
		ctx.announcePeer()
		await ctx.shareButtons(true)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('subscribe', {
				buttons: [{ button, width: 72, height: 72, have: null }],
			})
		)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.press', {
				id: 'm3',
				expiresAt: Date.now() + 10_000,
				button,
				pressed: true,
				surfaceId: 's',
			})
		)
		await flush()

		const updates = ctx.transport().messagesOfType('button.update')
		expect(updates).toMatchObject([{ peerId: 'peer' }])
		expect(ctx.controls.pressControl).toHaveBeenCalledWith('control1', true, 'link:peer:s')
	})

	test('a button held by a peer stays held when it becomes unreachable, as with an unplugged surface', async () => {
		ctx.announcePeer()
		await ctx.shareButtons(true)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.press', {
				id: 'held',
				expiresAt: Date.now() + 10_000,
				button,
				pressed: true,
				surfaceId: 's',
			})
		)
		ctx.controls.pressControl.mockClear()

		ctx.transport().context.receiveAnnouncement('peer', null)
		expect(ctx.controls.pressControl).not.toHaveBeenCalled()
	})

	test('when a peer loses permission, it is told, and what it held is released', async () => {
		ctx.announcePeer()
		await ctx.shareButtons(true)
		ctx.sendToSelf(
			fromPeer,
			encodeLinkMessage('button.press', {
				id: 'm4',
				expiresAt: Date.now() + 10_000,
				button,
				pressed: true,
				surfaceId: 's',
			})
		)
		ctx.controls.pressControl.mockClear()
		ctx.transport().sent.length = 0

		await ctx.shareButtons(false)

		expect(ctx.transport().messagesOfType('access')).toMatchObject([
			{ peerId: 'peer', message: { payload: { permissions: { buttons: false } } } },
		])
		expect(ctx.controls.pressControl).toHaveBeenCalledWith('control1', false, 'link:peer:s')
	})

	test('answers a pages request from a peer that is not allowed buttons with what it may use', () => {
		ctx.announcePeer()
		ctx.transport().sent.length = 0
		ctx.sendToSelf(fromPeer, encodeLinkMessage('pages.request', { id: 'r1' }))

		expect(ctx.transport().messagesOfType('pages')).toEqual([])
		expect(ctx.transport().messagesOfType('access')).toMatchObject([
			{ peerId: 'peer', message: { payload: { permissions: { buttons: false } } } },
		])
	})
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportConfig } from '@companion-app/shared/Model/Link.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import { LinkController } from '../../lib/Link/Controller.js'
import { encodeLinkAnnouncement } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage, type LinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import type {
	LinkMessageOrigin,
	LinkTransport,
	LinkTransportContext,
	LinkTransportDefinition,
} from '../../lib/Link/Transports/Types.js'
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

/** A controller with one transport, connected, on a database that can be reused to restart it */
function createController(db = new FakeDataDatabase()) {
	db.getTableView('link_transports').data.t1 = {
		id: 't1',
		type: 'fake',
		label: 'Fake',
		enabled: true,
		config: {},
		sortOrder: 0,
	} satisfies LinkTransportConfig

	const instances: FakeTransport[] = []
	const definition: LinkTransportDefinition<Record<string, never>> = {
		type: 'fake',
		name: 'Fake',
		description: 'Fake',
		configFields: [],
		create: (context) => {
			const instance = new FakeTransport(context)
			instances.push(instance)
			return instance
		},
	}

	const userconfig = {
		getKey: () => 'Self',
		on: vi.fn(),
	} as unknown as DataUserConfig

	const controller = new LinkController({ appVersion: '5.0.0' } as any, db.asDataDatabase(), userconfig, [definition])

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

	return { db, controller, instances, transport, announcePeer, sendToSelf, shareButtons }
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

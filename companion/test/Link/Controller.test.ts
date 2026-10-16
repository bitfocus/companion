import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportConfig } from '@companion-app/shared/Model/Link.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import { LinkController } from '../../lib/Link/Controller.js'
import { encodeLinkAnnouncement, linkDiscoveryTopic } from '../../lib/Link/Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage, type LinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { linkInboxTopic } from '../../lib/Link/Protocol/v1/Topics.js'
import type {
	LinkMessageOrigin,
	LinkPublishOptions,
	LinkTransport,
	LinkTransportContext,
	LinkTransportDefinition,
} from '../../lib/Link/Transports/Types.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

class FakeTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly published: { topic: string; payload: string; message: LinkMessage | null; options: LinkPublishOptions }[] =
		[]

	constructor(context: LinkTransportContext) {
		this.context = context
	}
	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		const decoded = payload ? decodeLinkMessage(payload) : null
		this.published.push({ topic, payload, message: decoded?.ok ? decoded.message : null, options })
	}
	subscribe(): void {}
	unsubscribe(): void {}
	async handleSectionAction(): Promise<string | null> {
		return null
	}
	async destroy(): Promise<void> {}

	messagesOfType(type: LinkMessage['type']) {
		return this.published.filter((p) => p.message?.type === type)
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

	function announcePeer(origin: LinkMessageOrigin) {
		transport().context.receive(
			linkDiscoveryTopic('peer'),
			encodeLinkAnnouncement({
				name: 'Peer',
				companionVersion: '5.0.0',
				protocolVersions: ['1.0.0'],
				announceIntervalMs: 15_000,
			}),
			origin
		)
	}

	function sendToSelf(origin: LinkMessageOrigin, message: string) {
		transport().context.receive(linkInboxTopic(transport().context.identity.id), message, origin)
	}

	async function shareButtons(buttons: boolean) {
		await controller
			.createTrpcRouter()
			.createCaller({} as any)
			.setPeerPermissions({ peerId: 'peer', permissions: { buttons } })
	}

	return { db, controller, transport, announcePeer, sendToSelf, shareButtons }
}

describe('LinkController', () => {
	let ctx: ReturnType<typeof createController>
	beforeEach(() => {
		ctx = createController()
	})
	afterEach(async () => {
		await ctx.controller.stop()
	})

	test('announces itself on the discovery topic of its Link id, which it keeps across restarts', async () => {
		const id = ctx.transport().context.identity.id
		const announcements = ctx.transport().published.filter((p) => p.topic === linkDiscoveryTopic(id))
		expect(announcements).toHaveLength(1)
		expect(announcements[0].options.retain).toBe(true)

		await ctx.controller.stop()
		ctx = createController(ctx.db)
		expect(ctx.transport().context.identity.id).toBe(id)
	})

	test('regenerating the id says goodbye as the old one, and announces as the new one', async () => {
		const before = ctx.transport()
		const oldId = before.context.identity.id

		await ctx.controller
			.createTrpcRouter()
			.createCaller({} as any)
			.regenerateId()
		expect(before.published.at(-1)).toMatchObject({ topic: linkDiscoveryTopic(oldId), payload: '' })

		const after = ctx.transport()
		const newId = after.context.identity.id
		expect(newId).not.toBe(oldId)
		after.context.setStatus('connected', null)
		expect(after.published.some((p) => p.topic === linkDiscoveryTopic(newId) && p.payload !== '')).toBe(true)
	})

	test('tells a newly reachable peer what it may use, and again when that changes', async () => {
		ctx.announcePeer(fromPeer)
		expect(ctx.transport().messagesOfType('access')).toMatchObject([
			{ topic: linkInboxTopic('peer'), message: { payload: { permissions: { buttons: false } } } },
		])

		await ctx.shareButtons(true)
		expect(ctx.transport().messagesOfType('access').at(-1)).toMatchObject({
			message: { payload: { permissions: { buttons: true } } },
		})
	})

	test('only accepts an announcement from the peer it is for', () => {
		ctx.announcePeer({ peerId: 'someone-else' })
		ctx.announcePeer({ peerId: null })
		expect(ctx.transport().messagesOfType('access')).toEqual([])

		ctx.announcePeer(fromPeer)
		expect(ctx.transport().messagesOfType('access')).toHaveLength(1)
	})

	test('answers a ping with a pong, and pings a newly reachable peer', () => {
		ctx.announcePeer(fromPeer)
		expect(ctx.transport().messagesOfType('ping')).toHaveLength(1)

		ctx.sendToSelf(fromPeer, encodeLinkMessage('ping', { nonce: 'abc' }))
		expect(ctx.transport().messagesOfType('pong')).toMatchObject([
			{ topic: linkInboxTopic('peer'), message: { payload: { nonce: 'abc' } } },
		])
	})
})

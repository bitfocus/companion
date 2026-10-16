import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportConfig } from '@companion-app/shared/Model/Link.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { ImageResult } from '../../lib/Graphics/ImageResult.js'
import { LinkController, type LinkHost } from '../../lib/Link/Controller.js'
import { decodeLinkMessage, encodeLinkMessage, type LinkMessage } from '../../lib/Link/Protocol/Schemas.js'
import { linkDiscoveryTopic, linkInboxTopic } from '../../lib/Link/Protocol/Topics.js'
import type {
	LinkMessageOrigin,
	LinkPublishOptions,
	LinkTransport,
	LinkTransportContext,
	LinkTransportDefinition,
} from '../../lib/Link/Transports/Types.js'
import type { IPageStore } from '../../lib/Page/Store.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

class FakeTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly published: { topic: string; message: LinkMessage | null; options: LinkPublishOptions }[] = []

	constructor(context: LinkTransportContext) {
		this.context = context
	}
	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		const decoded = payload ? decodeLinkMessage(payload) : null
		this.published.push({ topic, message: decoded?.ok ? decoded.message : null, options })
	}
	subscribe(): void {}
	unsubscribe(): void {}
	async handleAction(): Promise<string | null> {
		return null
	}
	async destroy(): Promise<void> {}

	messagesOfType(type: LinkMessage['type']) {
		return this.published.filter((p) => p.message?.type === type)
	}
}

const allowed: LinkMessageOrigin = { connectionId: 'conn', permissions: { buttons: true } }
const denied: LinkMessageOrigin = { connectionId: 'conn', permissions: { buttons: false } }
const button = { page: 1, row: 0, column: 0 }

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
}

describe('LinkController permissions', () => {
	let transport: FakeTransport
	let controller: LinkController
	let host: { [K in keyof LinkHost]: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		const db = new FakeDataDatabase()
		db.getTableView('link').data.id = 'self'
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
			getKey: (key: string) => (key === 'gridSize' ? { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 } : 'Self'),
			on: vi.fn(),
		} as unknown as DataUserConfig
		const pageStore = Object.assign(new EventEmitter(), {
			getPageCount: () => 1,
			getControlIdAt: () => null,
		}) as unknown as IPageStore

		controller = new LinkController({ appVersion: '5.0.0' } as any, db.asDataDatabase(), userconfig, pageStore, [
			definition,
		])

		host = {
			getCachedRenderOrGeneratePlaceholder: vi.fn(
				() =>
					({
						style: { type: 'button', state: { pushed: false } },
						drawNativeEncoded: async () => 'data:image/png;base64,AAAA',
					}) as unknown as ImageResult
			),
			getControlIdAt: vi.fn(() => 'control1'),
			pressControl: vi.fn(() => true),
			rotateControl: vi.fn(() => true),
		}
		controller.start(host as unknown as LinkHost)

		transport = instances[0]
		transport.context.setStatus('connected', null)
	})

	afterEach(async () => {
		await controller.stop()
	})

	function announcePeer(origin: LinkMessageOrigin) {
		transport.context.receive(
			linkDiscoveryTopic('peer'),
			encodeLinkMessage('announcement', {
				id: 'peer',
				name: 'Peer',
				companionVersion: '5.0.0',
				protocolVersion: '1.0.0',
				pageCount: 1,
				grid: { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 },
				announceIntervalMs: 15_000,
			}),
			origin
		)
	}

	function sendToSelf(origin: LinkMessageOrigin, message: string) {
		transport.context.receive(linkInboxTopic('self'), message, origin)
	}

	test('tells a newly reachable peer what it may use', () => {
		announcePeer(denied)
		expect(transport.messagesOfType('access')).toMatchObject([
			{ topic: linkInboxTopic('peer'), message: { payload: { sourceId: 'self', permissions: { buttons: false } } } },
		])
	})

	test('ignores button requests from a connection that is not allowed them', async () => {
		announcePeer(denied)
		sendToSelf(
			denied,
			encodeLinkMessage('subscribe', {
				requestorId: 'peer',
				buttons: [{ ...button, width: 72, height: 72 }],
				sendCurrent: true,
			})
		)
		sendToSelf(
			denied,
			encodeLinkMessage('button.press', { ...button, sourceId: 'peer', pressed: true, surfaceId: 's' })
		)
		sendToSelf(denied, encodeLinkMessage('button.rotate', { ...button, sourceId: 'peer', delta: 1, surfaceId: 's' }))
		await flush()

		expect(transport.messagesOfType('button.update')).toEqual([])
		expect(host.pressControl).not.toHaveBeenCalled()
		expect(host.rotateControl).not.toHaveBeenCalled()
	})

	test('serves an allowed connection, publishing images only to those allowed buttons', async () => {
		announcePeer(allowed)
		sendToSelf(
			allowed,
			encodeLinkMessage('subscribe', {
				requestorId: 'peer',
				buttons: [{ ...button, width: 72, height: 72 }],
				sendCurrent: true,
			})
		)
		sendToSelf(
			allowed,
			encodeLinkMessage('button.press', { ...button, sourceId: 'peer', pressed: true, surfaceId: 's' })
		)
		await flush()

		const updates = transport.messagesOfType('button.update')
		expect(updates).toHaveLength(1)
		expect(updates[0].options.requires).toBe('buttons')
		expect(host.pressControl).toHaveBeenCalledWith('control1', true, 'link:peer:s')
	})

	test('when a connection loses permission, its peers are told, and what they held is released', async () => {
		announcePeer(allowed)
		sendToSelf(
			allowed,
			encodeLinkMessage('button.press', { ...button, sourceId: 'peer', pressed: true, surfaceId: 's' })
		)
		host.pressControl.mockClear()
		transport.published.length = 0

		transport.context.setConnectionPermissions('conn', { buttons: false })

		expect(transport.messagesOfType('access')).toMatchObject([
			{ topic: linkInboxTopic('peer'), message: { payload: { permissions: { buttons: false } } } },
		])
		expect(host.pressControl).toHaveBeenCalledWith('control1', false, 'link:peer:s')
	})
})

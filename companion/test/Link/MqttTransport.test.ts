import net from 'node:net'
import { Aedes } from 'aedes'
import getPort from 'get-port'
import type { JsonValue } from 'type-fest'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportStatus } from '@companion-app/shared/Model/Link.js'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { MqttTransport, type MqttTransportConfig } from '../../lib/Link/Transports/Mqtt/MqttTransport.js'
import type { LinkMessageOrigin, LinkTransportContext } from '../../lib/Link/Transports/Types.js'
import LogController from '../../lib/Log/Controller.js'

function createContext(name: string) {
	const storage = new Map<string, JsonValue>()
	const received: [string, string, LinkMessageOrigin][] = []
	const state = { status: 'disabled' as LinkTransportStatus, message: null as string | null }

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${name}`),
		identity: LinkIdentity.generate(),
		getName: () => name,
		lastWill: { topic: `discovery/${name}`, payload: '', retain: true },
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receive: (topic, payload, origin) => received.push([topic, payload, origin]),
		getPermissions: () => ({ buttons: false }),
		setStatus: (status, message) => {
			state.status = status
			state.message = message
		},
		setInfo: () => {},
		setSections: () => {},
	}

	return { context, received, state }
}

describe('mqtt transport', { timeout: 10_000 }, () => {
	let broker: Aedes
	let server: net.Server
	let port: number
	const transports: MqttTransport[] = []

	beforeEach(async () => {
		port = await getPort()
		broker = await Aedes.createBroker()
		server = net.createServer(broker.handle)
		await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
	})

	afterEach(async () => {
		await Promise.all(transports.map(async (t) => t.destroy()))
		transports.length = 0
		await new Promise<void>((resolve) => broker.close(() => resolve()))
		await new Promise<void>((resolve) => server.close(() => resolve()))
	})

	async function start(name: string, overrides: Partial<MqttTransportConfig> = {}) {
		const ctx = createContext(name)
		const transport = new MqttTransport(ctx.context, {
			url: `mqtt://127.0.0.1:${port}`,
			username: '',
			password: '',
			topicPrefix: 'companion-link',
			allowUntrustedCertificate: false,
			...overrides,
		})
		transports.push(transport)
		await vi.waitFor(() => expect([ctx.state.status, ctx.state.message]).toEqual(['connected', null]))
		return { transport, ctx }
	}

	/** Collect what is published on the broker, with the topics as the broker sees them */
	function watchBroker() {
		const published: string[] = []
		broker.on('publish', (packet, client) => {
			if (client) published.push(packet.topic)
		})
		return published
	}

	test('puts topics under the prefix, and strips it from what arrives', async () => {
		const published = watchBroker()
		const a = await start('a')
		const b = await start('b')

		b.transport.subscribe('discovery/+')
		await vi.waitFor(() => expect(broker.connectedClients).toBe(2))
		// Give the subscription a moment to reach the broker
		await new Promise((resolve) => setTimeout(resolve, 100))

		a.transport.publish('discovery/a', 'hello', { retain: false, requires: null })
		await vi.waitFor(() => expect(b.ctx.received).toHaveLength(1))

		expect(b.ctx.received[0]).toEqual(['discovery/a', 'hello', { peerId: a.ctx.context.identity.id }])
		expect(published).toContain('companion-link/discovery/a')
	})

	test('installations with different prefixes do not see each other', async () => {
		const a = await start('a', { topicPrefix: 'group-a' })
		const b = await start('b', { topicPrefix: 'group-b/' })
		const c = await start('c', { topicPrefix: 'group-b' })

		b.transport.subscribe('discovery/+')
		await new Promise((resolve) => setTimeout(resolve, 100))

		a.transport.publish('discovery/a', 'from a', { retain: false, requires: null })
		c.transport.publish('discovery/c', 'from c', { retain: false, requires: null })

		await vi.waitFor(() => expect(b.ctx.received).toHaveLength(1))
		await new Promise((resolve) => setTimeout(resolve, 100))
		expect(b.ctx.received.map(([topic]) => topic)).toEqual(['discovery/c'])
	})

	test('drops messages that are not signed by who they claim to be from', async () => {
		const a = await start('a')
		const b = await start('b')
		b.transport.subscribe('discovery/+')
		await new Promise((resolve) => setTimeout(resolve, 100))

		const forged = JSON.stringify({ from: a.ctx.context.identity.id, payload: 'forged', signature: 'AAAA' })
		await new Promise<void>((resolve) =>
			broker.publish(
				{ cmd: 'publish', topic: 'companion-link/discovery/a', payload: forged, qos: 0, dup: false, retain: false },
				() => resolve()
			)
		)
		a.transport.publish('discovery/a', 'genuine', { retain: false, requires: null })

		await vi.waitFor(() => expect(b.ctx.received.map(([, payload]) => payload)).toEqual(['genuine']))
	})

	test('retained messages reach later subscribers', async () => {
		const a = await start('a')
		a.transport.publish('discovery/a', 'retained', { retain: true, requires: null })

		const b = await start('b')
		b.transport.subscribe('discovery/+')
		await vi.waitFor(() => expect(b.ctx.received.map(([, payload]) => payload)).toEqual(['retained']))
	})

	test('the broker publishes the last will, under the prefix, when the connection is lost', async () => {
		const b = await start('b')
		b.transport.subscribe('discovery/+')

		const a = await start('a')
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Drop the connection without a clean disconnect
		const clients = (broker as unknown as { clients: Record<string, { id: string; conn: net.Socket }> }).clients
		for (const client of Object.values(clients)) {
			if (client.id.includes(a.ctx.context.identity.id)) client.conn.destroy()
		}

		await vi.waitFor(() => expect(b.ctx.received).toContainEqual(['discovery/a', '', expect.anything()]))
		expect(a.ctx.state.status).not.toBe('connected')
	})
})

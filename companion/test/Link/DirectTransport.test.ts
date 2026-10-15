import getPort from 'get-port'
import type { JsonValue } from 'type-fest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportInfoItem, LinkTransportStatus } from '@companion-app/shared/Model/Link.js'
import { DirectClientTransport } from '../../lib/Link/Transports/Direct/ClientTransport.js'
import { DirectServerTransport } from '../../lib/Link/Transports/Direct/ServerTransport.js'
import type { LinkTransport, LinkTransportContext } from '../../lib/Link/Transports/Types.js'
import LogController from '../../lib/Log/Controller.js'

// Bind to ipv4: some sandboxed environments have no ipv6 at all. Hoisted so it is set before the constants load
vi.hoisted(() => {
	process.env.DISABLE_IPV6 = '1'
})

function createContext(peerId: string) {
	const storage = new Map<string, JsonValue>()
	const received: [string, string][] = []
	let status: LinkTransportStatus = 'disabled'
	let message: string | null = null
	let info: LinkTransportInfoItem[] = []

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${peerId}`),
		peerId,
		lastWill: { topic: `discovery/${peerId}`, payload: '', retain: true },
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receive: (topic, payload) => received.push([topic, payload]),
		setStatus: (newStatus, newMessage) => {
			status = newStatus
			message = newMessage
		},
		setInfo: (newInfo) => {
			info = newInfo
		},
	}

	return {
		context,
		received,
		get status() {
			return status
		},
		get message() {
			return message
		},
		get info() {
			return info
		},
	}
}

describe('direct transport', { timeout: 20_000 }, () => {
	const transports: LinkTransport[] = []
	afterEach(async () => {
		await Promise.all(transports.map(async (t) => t.destroy()))
		transports.length = 0
	})

	async function startServer() {
		const port = await getPort()
		const ctx = createContext('server')
		const server = new DirectServerTransport(ctx.context, { port })
		transports.push(server)
		await vi.waitFor(() => expect(ctx.status).toBe('connected'), { timeout: 15_000 })

		const fingerprint = ctx.info.find((i) => i.label === 'Certificate fingerprint')?.value
		if (!fingerprint) throw new Error('No fingerprint reported')

		return { server, ctx, port, fingerprint }
	}

	test('exchanges messages, including retained ones and the last will', async () => {
		const { server, ctx: serverCtx, port, fingerprint } = await startServer()

		server.subscribe('discovery/+')
		server.subscribe('inbox/server')
		server.publish('discovery/server', 'server hello', { retain: true })

		const clientCtx = createContext('client')
		const client = new DirectClientTransport(clientCtx.context, { url: `wss://127.0.0.1:${port}`, fingerprint })
		transports.push(client)
		client.subscribe('discovery/+')
		client.publish('discovery/client', 'client hello', { retain: true })

		await vi.waitFor(() => expect(clientCtx.status).toBe('connected'))
		expect(clientCtx.message).toBeNull()

		// The retained messages are exchanged once each side subscribes
		await vi.waitFor(() => expect(clientCtx.received).toContainEqual(['discovery/server', 'server hello']))
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['discovery/client', 'client hello']))

		// Messages only go where they are subscribed
		client.publish('inbox/server', 'press', { retain: false })
		client.publish('inbox/elsewhere', 'nope', { retain: false })
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['inbox/server', 'press']))
		expect(serverCtx.received).not.toContainEqual(['inbox/elsewhere', 'nope'])

		// When the client goes, its retained announcement is cleared on the server
		await client.destroy()
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['discovery/client', '']))
	})

	test('warns when the certificate is not pinned', async () => {
		const { port } = await startServer()

		const clientCtx = createContext('client')
		transports.push(new DirectClientTransport(clientCtx.context, { url: `wss://127.0.0.1:${port}`, fingerprint: '' }))

		await vi.waitFor(() => expect(clientCtx.status).toBe('connected'))
		expect(clientCtx.message).toMatch(/not pinned/)
		expect(clientCtx.info.some((i) => i.label === 'Server certificate fingerprint')).toBe(true)
	})

	test('refuses a server with a different certificate', async () => {
		const { port } = await startServer()

		const clientCtx = createContext('client')
		transports.push(
			new DirectClientTransport(clientCtx.context, { url: `wss://127.0.0.1:${port}`, fingerprint: 'AB:CD:EF' })
		)

		await vi.waitFor(() => expect(clientCtx.message).toMatch(/does not match/))
		expect(clientCtx.status).toBe('error')
	})

	test('keeps its certificate across restarts', async () => {
		const port = await getPort()
		const ctx = createContext('server')

		const first = new DirectServerTransport(ctx.context, { port })
		await vi.waitFor(() => expect(ctx.status).toBe('connected'), { timeout: 15_000 })
		const fingerprint = ctx.info.find((i) => i.label === 'Certificate fingerprint')?.value
		await first.destroy()

		const second = new DirectServerTransport(ctx.context, { port })
		transports.push(second)
		await vi.waitFor(() => expect(ctx.info.find((i) => i.label === 'Certificate fingerprint')?.value).toBe(fingerprint))
	})
})

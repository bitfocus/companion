import getPort from 'get-port'
import { generateKeyPair } from 'noise-handshake/dh.js'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { DirectClientTransport } from '../../lib/Link/Transports/Direct/ClientTransport.js'
import { websocketMessagePipe } from '../../lib/Link/Transports/Secure/MessagePipe.js'
import { SecureChannel } from '../../lib/Link/Transports/Secure/SecureChannel.js'
import { DirectTestTransports, pairingCode, pendingEntryId } from './helpers/DirectTestHelpers.js'
import { describeLinkTransportContract, type TransportContractSetup } from './helpers/TransportContract.js'
import { createTransportTestContext } from './helpers/TransportTestContext.js'

// Bind to ipv4: some sandboxed environments have no ipv6 at all. Hoisted so it is set before the constants load
vi.hoisted(() => {
	process.env.DISABLE_IPV6 = '1'
})

describe('direct transport', { timeout: 20_000 }, () => {
	const direct = new DirectTestTransports()
	afterEach(async () => direct.destroyAll())

	const startServer = direct.startServer.bind(direct)
	const startClient = direct.startClient.bind(direct)
	const pair = direct.pair.bind(direct)

	test('pairs by entering the code shown on the client, then exchanges messages', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		server.announce('server hello')

		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		client.announce('client hello')
		const serverId = serverCtx.context.identity.id
		const clientId = clientCtx.context.identity.id

		// The pairing request has gone, and the client is listed as paired
		expect(serverCtx.state.sections.find((s) => s.id === 'pending')).toBeUndefined()
		expect(serverCtx.state.sections.find((s) => s.id === 'paired')?.entries.map((e) => e.title)).toEqual(['client'])
		// The client shows who it is paired with, with nothing to act on while it works
		expect(clientCtx.state.sections).toEqual([])
		expect(clientCtx.state.info).toContainEqual(
			expect.objectContaining({ label: 'Paired with', value: expect.stringMatching(/^server \(/) })
		)

		// Each side gets the other's announcement: the one made before connecting, and the one made after
		await vi.waitFor(() => expect(clientCtx.announcements).toContainEqual([serverId, 'server hello']))
		await vi.waitFor(() => expect(serverCtx.announcements).toContainEqual([clientId, 'client hello']))

		// Messages are from the Link id proven in the handshake
		client.send(serverId, 'press')
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['press', { peerId: clientId }]))

		// Messages larger than one Noise message are split and reassembled
		const large = 'x'.repeat(200_000)
		client.send(serverId, large)
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual([large, { peerId: clientId }]))

		// When the client goes, the server is told it has gone
		await client.destroy()
		await vi.waitFor(() => expect(serverCtx.announcements.at(-1)).toEqual([clientId, null]))
	})

	test('a paired connection stays up after its pairing request would have timed out', async () => {
		// Only timeouts are faked, so that the sockets still work
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		try {
			const { server, ctx: serverCtx, port } = await startServer()
			const { ctx: clientCtx } = await pair(server, serverCtx, port)

			await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
			await new Promise((resolve) => setImmediate(resolve))
			expect(clientCtx.state.status).toBe('connected')
			expect(serverCtx.state.info).toContainEqual({ label: 'Connected installations', value: '1' })
		} finally {
			vi.useRealTimers()
		}
	})

	test('nothing is exchanged before pairing', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		server.announce('server hello')

		const { client, ctx: clientCtx } = startClient(port)
		client.announce('hello')
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())

		expect(clientCtx.state.status).toBe('connecting')
		expect(serverCtx.announcements).toEqual([])
		expect(clientCtx.announcements).toEqual([])
	})

	test('a wrong code is refused, and too many reject the request', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { ctx: clientCtx } = startClient(port)
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		const entryId = pendingEntryId(serverCtx)!

		expect(await server.handleSectionAction(entryId, 'pair', '0000-0000')).toMatch(/doesn't match/)
		expect(await server.handleSectionAction(entryId, 'pair', '1111-1111')).toMatch(/doesn't match/)
		expect(await server.handleSectionAction(entryId, 'pair', '2222-2222')).toMatch(/too many/)

		await vi.waitFor(() => expect(clientCtx.state.message).toMatch(/rejected/))
		expect(clientCtx.state.status).toBe('error')
	})

	test('rejecting a request stops the client retrying, until asked to', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { client, ctx: clientCtx } = startClient(port)
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())

		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'reject', null)).toBeNull()
		await vi.waitFor(() => expect(clientCtx.state.message).toMatch(/rejected/))
		expect(clientCtx.state.sections[0]?.entries[0]?.actions.map((a) => a.id)).toEqual(['retry'])

		expect(await client.handleSectionAction('pairing', 'retry', null)).toBeNull()
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
	})

	test('once paired, reconnecting needs no code', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		await client.destroy()

		// A new instance, as after a restart, with the same storage
		const again = startClient(port, createTransportTestContext('client', clientCtx.storage))
		await vi.waitFor(() => expect(again.ctx.state.status).toBe('connected'))
		expect(pendingEntryId(serverCtx)).toBeUndefined()
	})

	test('reconnects by itself, quickly and without a code, after the connection drops', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { ctx: clientCtx } = await pair(server, serverCtx, port)
		await server.destroy()

		await vi.waitFor(() => expect(clientCtx.state.status).not.toBe('connected'))
		expect(clientCtx.state.message).toMatch(/retrying/)

		// The same installation comes back
		const restarted = Date.now()
		await startServer(createTransportTestContext('server', serverCtx.storage), port)
		await vi.waitFor(() => expect(clientCtx.state.status).toBe('connected'), { timeout: 10_000 })
		expect(Date.now() - restarted).toBeLessThan(5_000)
	})

	test('connects through a full ws:// url with a path, as through a reverse proxy', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const ctx = createTransportTestContext('client')
		direct.track(
			new DirectClientTransport(ctx.context, { bonjourHost: null, address: `ws://127.0.0.1:${port}/some/sub/path` })
		)

		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		await vi.waitFor(() => expect(pairingCode(ctx)).toBeDefined())
		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'pair', pairingCode(ctx)!)).toBeNull()
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))
	})

	test('connects to the installation chosen from those discovered, rather than the address', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const ctx = createTransportTestContext('client')
		direct.track(new DirectClientTransport(ctx.context, { bonjourHost: `127.0.0.1:${port}`, address: 'not a host' }))

		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		await vi.waitFor(() => expect(pairingCode(ctx)).toBeDefined())
		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'pair', pairingCode(ctx)!)).toBeNull()
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))
	})

	test('asks for an installation or an address when neither is set', () => {
		const ctx = createTransportTestContext('client')
		direct.track(new DirectClientTransport(ctx.context, { bonjourHost: null, address: ' ' }))
		expect(ctx.state.status).toBe('error')
		expect(ctx.state.message).toBe('Choose an installation, or enter its address')
	})

	test('reports an invalid address without connecting', () => {
		const ctx = createTransportTestContext('client')
		direct.track(new DirectClientTransport(ctx.context, { bonjourHost: null, address: 'not a host' }))
		expect(ctx.state.status).toBe('error')
		expect(ctx.state.message).toMatch(/not a valid address/)
	})

	test('refuses a server whose identity has changed', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		await client.destroy()
		await server.destroy()

		// A different installation (new identity) on the same address
		await startServer(createTransportTestContext('impostor'), port)
		const again = startClient(port, createTransportTestContext('client', clientCtx.storage))
		await vi.waitFor(() => expect(again.ctx.state.message).toMatch(/different identity/))
		expect(again.ctx.state.status).toBe('error')
	})

	test('a client that has forgotten its pairing must pair again, although the server remembers it', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)

		expect(await client.handleSectionAction('pairing', 'forget', null)).toBeNull()

		await vi.waitFor(() => expect(pairingCode(clientCtx)).toBeDefined(), { timeout: 10_000 })
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		expect(clientCtx.state.status).toBe('connecting')
	})

	test('a client refuses a server that claims to be paired with it when it never was', async () => {
		const port = await getPort()
		const impostor = new WebSocketServer({ host: '127.0.0.1', port })
		impostor.on('connection', (socket) => {
			SecureChannel.establish(
				websocketMessagePipe(socket),
				false,
				generateKeyPair(),
				LinkIdentity.generate(),
				'impostor',
				65535,
				5000
			)
				.then((channel) => {
					channel.setHandler(() => {})
					channel.send(JSON.stringify({ op: 'auth', status: 'paired' }))
				})
				.catch(() => socket.terminate())
		})
		try {
			const { ctx } = startClient(port)
			await vi.waitFor(() => expect(ctx.state.message).toMatch(/never was/))
			expect(ctx.state.status).toBe('error')
			expect(ctx.storage.get('pairedServer') ?? null).toBeNull()
		} finally {
			for (const client of impostor.clients) client.terminate()
			await new Promise((resolve) => impostor.close(resolve))
		}
	})

	test('unpairing disconnects the client, and it must pair again', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { ctx: clientCtx } = await pair(server, serverCtx, port)

		const pairedEntry = serverCtx.state.sections.find((s) => s.id === 'paired')!.entries[0]
		expect(await server.handleSectionAction(pairedEntry.id, 'unpair', null)).toBeNull()

		await vi.waitFor(() => expect(pairingCode(clientCtx)).toBeDefined(), { timeout: 10_000 })
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
	})
})

describeLinkTransportContract(
	'direct',
	async () => {
		const direct = new DirectTestTransports()
		const serverCtx = createTransportTestContext('server')
		const started = await direct.startServer(serverCtx)
		const { client, ctx: clientCtx } = await direct.pair(started.server, serverCtx, started.port)

		const setup: TransportContractSetup = {
			a: { transport: started.server, ctx: serverCtx },
			b: { transport: client, ctx: clientCtx },
			dropB: async () => client.destroy(),
			reconnect: async () => {
				// The server restarts, as the same installation on the same port
				await setup.a.transport.destroy()
				await vi.waitFor(() => expect(clientCtx.state.status).not.toBe('connected'))
				const restarted = await direct.startServer(serverCtx, started.port)
				setup.a = { transport: restarted.server, ctx: serverCtx }
				await vi.waitFor(() => expect(clientCtx.state.status).toBe('connected'), { timeout: 10_000 })
			},
			destroy: async () => direct.destroyAll(),
		}
		return setup
	},
	{ timeout: 20_000 }
)

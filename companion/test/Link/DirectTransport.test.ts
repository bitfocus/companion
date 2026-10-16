import getPort from 'get-port'
import type { JsonValue } from 'type-fest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type {
	LinkPermissions,
	LinkTransportInfoItem,
	LinkTransportSection,
	LinkTransportStatus,
} from '@companion-app/shared/Model/Link.js'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { DirectClientTransport } from '../../lib/Link/Transports/Direct/ClientTransport.js'
import { DirectServerTransport } from '../../lib/Link/Transports/Direct/ServerTransport.js'
import type { LinkMessageOrigin, LinkTransport, LinkTransportContext } from '../../lib/Link/Transports/Types.js'
import LogController from '../../lib/Log/Controller.js'

// Bind to ipv4: some sandboxed environments have no ipv6 at all. Hoisted so it is set before the constants load
vi.hoisted(() => {
	process.env.DISABLE_IPV6 = '1'
})

/** The identity of each installation, by its storage, so that reusing the storage is the same installation */
const identities = new WeakMap<Map<string, JsonValue>, LinkIdentity>()

function createContext(name: string, storage = new Map<string, JsonValue>()) {
	let identity = identities.get(storage)
	if (!identity) {
		identity = LinkIdentity.generate()
		identities.set(storage, identity)
	}

	const received: [string, string][] = []
	const origins: LinkMessageOrigin[] = []
	/** What the core lets each installation use */
	const permissions = new Map<string, LinkPermissions>()
	const state = {
		status: 'disabled' as LinkTransportStatus,
		message: null as string | null,
		info: [] as LinkTransportInfoItem[],
		sections: [] as LinkTransportSection[],
	}

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${name}`),
		identity,
		getName: () => name,
		lastWill: { topic: `discovery/${name}`, payload: '', retain: true },
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receive: (topic, payload, origin) => {
			received.push([topic, payload])
			origins.push(origin)
		},
		getPermissions: (peerId) => permissions.get(peerId) ?? { buttons: false },
		setStatus: (status, message) => {
			state.status = status
			state.message = message
		},
		setInfo: (info) => {
			state.info = info
		},
		setSections: (sections) => {
			state.sections = sections
		},
	}

	return { context, received, origins, permissions, state, storage }
}

type TestContext = ReturnType<typeof createContext>

function pendingEntryId(ctx: TestContext): string | undefined {
	return ctx.state.sections.find((s) => s.id === 'pending')?.entries[0]?.id
}

function pairingCode(ctx: TestContext): string | undefined {
	return ctx.state.info.find((i) => i.label === 'Pairing code')?.value
}

describe('direct transport', { timeout: 20_000 }, () => {
	const transports: LinkTransport[] = []
	afterEach(async () => {
		await Promise.all(transports.map(async (t) => t.destroy()))
		transports.length = 0
	})

	async function startServer(ctx = createContext('server'), port?: number) {
		port ??= await getPort()
		const server = new DirectServerTransport(ctx.context, { port })
		transports.push(server)
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))
		return { server, ctx, port }
	}

	function startClient(port: number, ctx = createContext('client')) {
		const client = new DirectClientTransport(ctx.context, { address: `127.0.0.1:${port}` })
		transports.push(client)
		return { client, ctx }
	}

	/** Connect a client and pair it, by entering its code on the server */
	async function pair(server: DirectServerTransport, serverCtx: TestContext, port: number) {
		const { client, ctx } = startClient(port)

		await vi.waitFor(() => expect(pairingCode(ctx)).toBeDefined())
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		expect(ctx.state.message).toContain(pairingCode(ctx))

		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'pair', pairingCode(ctx)!)).toBeNull()
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))

		return { client, ctx }
	}

	test('pairs by entering the code shown on the client, then exchanges messages', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		server.subscribe('discovery/+')
		server.subscribe('inbox/server')
		server.publish('discovery/server', 'server hello', { retain: true, requires: null })

		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		client.subscribe('discovery/+')
		client.publish('discovery/client', 'client hello', { retain: true, requires: null })

		// The pairing request has gone, and the client is listed as paired
		expect(serverCtx.state.sections.find((s) => s.id === 'pending')).toBeUndefined()
		expect(serverCtx.state.sections.find((s) => s.id === 'paired')?.entries.map((e) => e.title)).toEqual(['client'])

		// Retained messages are exchanged once each side subscribes
		await vi.waitFor(() => expect(clientCtx.received).toContainEqual(['discovery/server', 'server hello']))
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['discovery/client', 'client hello']))

		// Messages only go where they are subscribed
		client.publish('inbox/server', 'press', { retain: false, requires: null })
		client.publish('inbox/elsewhere', 'nope', { retain: false, requires: null })
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['inbox/server', 'press']))
		expect(serverCtx.received).not.toContainEqual(['inbox/elsewhere', 'nope'])

		// Messages larger than one Noise message are split and reassembled
		const large = 'x'.repeat(200_000)
		client.publish('inbox/server', large, { retain: false, requires: null })
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['inbox/server', large]))

		// When the client goes, its retained announcement is cleared on the server
		await client.destroy()
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['discovery/client', '']))
	})

	test('messages are from the proven Link id, and only go to installations the core allows', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		server.subscribe('#')
		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		client.subscribe('#')
		const clientId = clientCtx.context.identity.id

		client.publish('inbox/server', 'hello', { retain: false, requires: null })
		await vi.waitFor(() => expect(serverCtx.received).toContainEqual(['inbox/server', 'hello']))
		expect(serverCtx.origins.at(-1)).toEqual({ peerId: clientId })

		// Button images are not sent to an installation that may not have them
		server.publish('button/x', 'image', { retain: false, requires: 'buttons' })
		server.publish('marker', 'after', { retain: false, requires: null })
		await vi.waitFor(() => expect(clientCtx.received).toContainEqual(['marker', 'after']))
		expect(clientCtx.received).not.toContainEqual(['button/x', 'image'])

		// Read for every message, so a change applies straight away
		serverCtx.permissions.set(clientId, { buttons: true })
		server.publish('button/x', 'image', { retain: false, requires: 'buttons' })
		await vi.waitFor(() => expect(clientCtx.received).toContainEqual(['button/x', 'image']))
	})

	test('nothing is exchanged before pairing', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		server.subscribe('#')

		const { client, ctx: clientCtx } = startClient(port)
		client.publish('discovery/client', 'hello', { retain: true, requires: null })
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())

		expect(clientCtx.state.status).toBe('connecting')
		expect(serverCtx.received).toEqual([])
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
		const again = startClient(port, createContext('client', clientCtx.storage))
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
		await startServer(createContext('server', serverCtx.storage), port)
		await vi.waitFor(() => expect(clientCtx.state.status).toBe('connected'), { timeout: 10_000 })
		expect(Date.now() - restarted).toBeLessThan(5_000)
	})

	test('connects through a full ws:// url with a path, as through a reverse proxy', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const ctx = createContext('client')
		transports.push(new DirectClientTransport(ctx.context, { address: `ws://127.0.0.1:${port}/some/sub/path` }))

		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		await vi.waitFor(() => expect(pairingCode(ctx)).toBeDefined())
		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'pair', pairingCode(ctx)!)).toBeNull()
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))
	})

	test('reports an invalid address without connecting', () => {
		const ctx = createContext('client')
		transports.push(new DirectClientTransport(ctx.context, { address: 'not a host' }))
		expect(ctx.state.status).toBe('error')
		expect(ctx.state.message).toMatch(/not a valid address/)
	})

	test('refuses a server whose identity has changed', async () => {
		const { server, ctx: serverCtx, port } = await startServer()
		const { client, ctx: clientCtx } = await pair(server, serverCtx, port)
		await client.destroy()
		await server.destroy()

		// A different installation (new identity) on the same address
		await startServer(createContext('impostor'), port)
		const again = startClient(port, createContext('client', clientCtx.storage))
		await vi.waitFor(() => expect(again.ctx.state.message).toMatch(/different identity/))
		expect(again.ctx.state.status).toBe('error')
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

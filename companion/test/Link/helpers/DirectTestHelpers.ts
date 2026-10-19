import getPort from 'get-port'
import { expect, vi } from 'vitest'
import { DirectClientTransport } from '../../../lib/Link/Transports/Direct/ClientTransport.js'
import { DirectServerTransport } from '../../../lib/Link/Transports/Direct/ServerTransport.js'
import type { LinkTransport } from '../../../lib/Link/Transports/Types.js'
import { createTransportTestContext, type TransportTestContext } from './TransportTestContext.js'

/** The pairing request waiting on a server, if there is one */
export function pendingEntryId(ctx: TransportTestContext): string | undefined {
	return ctx.state.sections.find((s) => s.id === 'pending')?.entries[0]?.id
}

/** The code a client shows while it waits to be paired */
export function pairingCode(ctx: TransportTestContext): string | undefined {
	return ctx.state.info.find((i) => i.label === 'Pairing code')?.value
}

/**
 * Starts direct transports for a test, and keeps track of them so that they can all be destroyed after it.
 * Set `process.env.DISABLE_IPV6` (hoisted) in the test file, as some environments have no ipv6
 */
export class DirectTestTransports {
	readonly #transports: LinkTransport[] = []

	async startServer(ctx = createTransportTestContext('server'), port?: number) {
		port ??= await getPort()
		const server = new DirectServerTransport(ctx.context, { port })
		this.#transports.push(server)
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))
		return { server, ctx, port }
	}

	startClient(port: number, ctx = createTransportTestContext('client')) {
		const client = new DirectClientTransport(ctx.context, { address: `127.0.0.1:${port}` })
		this.#transports.push(client)
		return { client, ctx }
	}

	/** Connect a client and pair it, by entering its code on the server */
	async pair(
		server: DirectServerTransport,
		serverCtx: TransportTestContext,
		port: number,
		ctx = createTransportTestContext('client')
	) {
		const { client } = this.startClient(port, ctx)

		await vi.waitFor(() => expect(pairingCode(ctx)).toBeDefined())
		await vi.waitFor(() => expect(pendingEntryId(serverCtx)).toBeDefined())
		expect(ctx.state.message).toContain(pairingCode(ctx))

		expect(await server.handleSectionAction(pendingEntryId(serverCtx)!, 'pair', pairingCode(ctx)!)).toBeNull()
		await vi.waitFor(() => expect(ctx.state.status).toBe('connected'))

		return { client, ctx }
	}

	/** Destroy a transport made some other way after the test too */
	track<T extends LinkTransport>(transport: T): T {
		this.#transports.push(transport)
		return transport
	}

	async destroyAll(): Promise<void> {
		await Promise.all(this.#transports.map(async (t) => t.destroy()))
		this.#transports.length = 0
	}
}

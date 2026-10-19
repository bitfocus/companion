import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransport } from '../../../lib/Link/Transports/Types.js'
import type { TransportTestContext } from './TransportTestContext.js'

export interface TransportContractEndpoint {
	transport: LinkTransport
	ctx: TransportTestContext
}

/** Two connected installations, each with a transport that reaches the other */
export interface TransportContractSetup {
	/** May be replaced by `reconnect`, so read it each time */
	a: TransportContractEndpoint
	b: TransportContractEndpoint
	/** `b` vanishes without saying goodbye, eg it crashed */
	dropB(): Promise<void>
	/** The connection between them drops, and then comes back with the same installations */
	reconnect(): Promise<void>
	destroy(): Promise<void>
}

export interface TransportContractOptions {
	timeout: number
}

/**
 * What every transport must guarantee (see lib/Link/Transports/README.md), as tests to run against each of them.
 * Messages are checked to have arrived, or not, by sending a marker after them and waiting for it, so that a
 * transport isn't required to deliver within a fixed time
 */
export function describeLinkTransportContract(
	name: string,
	createSetup: () => Promise<TransportContractSetup>,
	options: TransportContractOptions
): void {
	describe(`${name} transport contract`, { timeout: options.timeout }, () => {
		let setup: TransportContractSetup
		beforeEach(async () => {
			setup = await createSetup()
		})
		afterEach(async () => setup.destroy())

		const id = (endpoint: TransportContractEndpoint) => endpoint.ctx.context.identity.id

		let markers = 0
		/** Wait until a message sent by `from` now has reached `to`, so that everything sent before it has */
		async function sync(from: TransportContractEndpoint, to: TransportContractEndpoint): Promise<void> {
			const marker = `sync/${++markers}`
			// Sent until it arrives, as the connection may still be settling
			await vi.waitFor(
				() => {
					from.transport.send(id(to), marker)
					expect(to.ctx.received.map(([payload]) => payload)).toContain(marker)
				},
				{ timeout: 5000, interval: 50 }
			)
		}

		function receivedPayloads(endpoint: TransportContractEndpoint): string[] {
			return endpoint.ctx.received.map(([payload]) => payload).filter((payload) => !payload.startsWith('sync/'))
		}

		test('both ends report connected', () => {
			expect(setup.a.ctx.state.status).toBe('connected')
			expect(setup.b.ctx.state.status).toBe('connected')
		})

		test('an announcement reaches the other end, and so does withdrawing it', async () => {
			const { a, b } = setup
			a.transport.announce('hello')
			await vi.waitFor(() => expect(b.ctx.announcements).toContainEqual([id(a), 'hello']))

			a.transport.announce(null)
			await vi.waitFor(() => expect(b.ctx.announcements.at(-1)).toEqual([id(a), null]))
		})

		test('a message reaches the installation it is for, saying who sent it', async () => {
			const { a, b } = setup
			b.transport.send(id(a), 'hello')
			await sync(b, a)

			expect(a.ctx.received).toContainEqual(['hello', { peerId: id(b) }])
		})

		test('a message for another installation does not arrive', async () => {
			const { a, b } = setup
			a.transport.send('someone-else', 'not for b')
			await sync(a, b)

			expect(receivedPayloads(b)).toEqual([])
		})

		test('when an installation vanishes, the others are told it has gone', async () => {
			const { a, b } = setup
			b.transport.announce('hello')
			await vi.waitFor(() => expect(a.ctx.announcements).toContainEqual([id(b), 'hello']))

			await setup.dropB()
			await vi.waitFor(() => expect(a.ctx.announcements.at(-1)).toEqual([id(b), null]))
		})

		test('after a reconnect, the announcement reaches the other end again, and messages flow', async () => {
			const { b } = setup
			setup.a.transport.announce('hello')
			await vi.waitFor(() => expect(b.ctx.announcements).toContainEqual([id(setup.a), 'hello']))

			await setup.reconnect()
			expect(b.ctx.state.status).toBe('connected')
			b.ctx.announcements.length = 0

			// `a` may be a new instance now, which announces itself as the core would when it connects
			setup.a.transport.announce('hello')
			await vi.waitFor(() => expect(b.ctx.announcements).toContainEqual([id(setup.a), 'hello']), {
				timeout: 10_000,
			})
			await sync(setup.a, b)
		})

		test('carries a message of 1MB', async () => {
			const { a, b } = setup
			const payload = 'x'.repeat(1024 * 1024)
			a.transport.send(id(b), payload)
			await vi.waitFor(() => expect(b.ctx.received.find(([p]) => p.length === payload.length)).toBeDefined())
		})
	})
}

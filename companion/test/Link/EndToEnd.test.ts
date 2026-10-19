import getPort from 'get-port'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	DirectClientTransportDefinition,
	DirectServerBuiltinTransport,
} from '../../lib/Link/Transports/Direct/index.js'
import { LinkInstallation } from './helpers/LinkInstallation.js'
import { LoopbackNetwork, loopbackTransportDefinition, type LoopbackTransport } from './helpers/LoopbackTransport.js'

// Bind to ipv4: some sandboxed environments have no ipv6 at all. Hoisted so it is set before the constants load
vi.hoisted(() => {
	process.env.DISABLE_IPV6 = '1'
})

interface Linked {
	a: LinkInstallation
	b: LinkInstallation
}

/** Two installations on a loopback network, which reach each other as soon as they start */
async function linkOverLoopback(): Promise<Linked> {
	const network = new LoopbackNetwork()
	const instances: LoopbackTransport[] = []
	const create = (name: string) =>
		new LinkInstallation({
			name,
			transportDefinitions: [loopbackTransportDefinition(network, instances)],
			builtinTransports: [],
			transports: [{ id: 'loopback', type: 'loopback', label: 'Loopback', enabled: true, config: {} }],
			userConfig: {},
		})
	return { a: create('Studio A'), b: create('Studio B') }
}

/**
 * Two installations linked directly, as a user would: A accepts direct connections (built in, on by default), B adds
 * a "Direct connection" to it, and the code B shows is entered into the pairing request on A
 */
async function linkDirectly(): Promise<Linked> {
	const port = await getPort()
	const a = new LinkInstallation({
		name: 'Studio A',
		transportDefinitions: [],
		builtinTransports: [DirectServerBuiltinTransport],
		transports: [],
		userConfig: { link_direct_enabled: true, link_direct_port: port },
	})
	const b = new LinkInstallation({
		name: 'Studio B',
		transportDefinitions: [DirectClientTransportDefinition],
		builtinTransports: [],
		transports: [
			{ id: 'to-a', type: 'direct-client', label: 'To A', enabled: true, config: { address: `127.0.0.1:${port}` } },
		],
		userConfig: {},
	})

	return { a, b }
}

/** Pair B with A, once both have started */
async function pairDirectly({ a, b }: Linked): Promise<void> {
	const code = await vi.waitFor(async () => {
		const value = (await b.transportStates())['to-a']?.info.find((i) => i.label === 'Pairing code')?.value
		expect(value).toBeDefined()
		return value!
	})
	const entryId = await vi.waitFor(async () => {
		const id = (await a.transportStates())[DirectServerBuiltinTransport.id]?.sections.find((s) => s.id === 'pending')
			?.entries[0]?.id
		expect(id).toBeDefined()
		return id!
	})

	expect(
		await a.api.transportSectionAction({
			transportId: DirectServerBuiltinTransport.id,
			entryId,
			actionId: 'pair',
			input: code,
		})
	).toBeNull()
}

const NETWORKS = [
	{ name: 'loopback', link: linkOverLoopback, pair: async () => {} },
	{ name: 'direct', link: linkDirectly, pair: pairDirectly },
]

describe.each(NETWORKS)('two installations linked over $name', { timeout: 20_000 }, (network) => {
	let a: LinkInstallation
	let b: LinkInstallation
	let aId: string
	let bId: string

	beforeEach(async () => {
		;({ a, b } = await network.link())
		a.start()
		b.start()
		await network.pair({ a, b })

		aId = (await a.self()).id
		bId = (await b.self()).id
		await vi.waitFor(async () => {
			expect((await a.peers()).find((p) => p.id === bId)?.online).toBe(true)
			expect((await b.peers()).find((p) => p.id === aId)?.online).toBe(true)
		})
	})
	afterEach(async () => {
		await Promise.all([a.stop(), b.stop()])
	})

	async function shareButtons(from: LinkInstallation, withId: string, buttons: boolean) {
		await from.api.setPeerPermissions({ peerId: withId, permissions: { buttons } })
	}

	test('each discovers the other, and measures the round trip to it', async () => {
		expect((await b.peers()).find((p) => p.id === aId)).toMatchObject({
			name: 'Studio A',
			companionVersion: '5.2.0',
			compatible: true,
			sharedByUs: { buttons: false },
		})
		await vi.waitFor(async () => {
			const routes = (await b.peers()).find((p) => p.id === aId)?.routes
			expect(routes).toHaveLength(1)
			expect(routes?.[0].latencyMs).toEqual(expect.any(Number))
		})
	})

	test('what is shared is told to the other installation', async () => {
		expect((await b.peers()).find((p) => p.id === aId)?.sharedWithUs).toEqual({ buttons: false })

		await shareButtons(a, bId, true)
		await vi.waitFor(async () =>
			expect((await b.peers()).find((p) => p.id === aId)?.sharedWithUs).toEqual({ buttons: true })
		)

		await shareButtons(a, bId, false)
		await vi.waitFor(async () =>
			expect((await b.peers()).find((p) => p.id === aId)?.sharedWithUs).toEqual({ buttons: false })
		)
	})

	test('when an installation stops, the other sees it go offline', async () => {
		await a.stop()
		await vi.waitFor(async () => expect((await b.peers()).find((p) => p.id === aId)?.online).toBe(false))
	})
})

import getPort from 'get-port'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonState } from '../../lib/Link/ButtonClient.js'
import {
	DirectClientTransportDefinition,
	DirectServerBuiltinTransport,
} from '../../lib/Link/Transports/Direct/index.js'
import { fakeRender, LinkInstallation } from './helpers/LinkInstallation.js'
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

const location: ControlLocation = { pageNumber: 1, row: 0, column: 0 }

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

	/** Show a button of A on B, as a Remote button there would, shown at some sizes */
	function showOnB(controlId: string, target: ControlLocation, sizes = [{ width: 72, height: 72 }]) {
		const onChange = vi.fn()
		b.controller.buttonClient.setTarget(controlId, { peerId: aId, location: target }, onChange)
		b.controller.buttonClient.setDisplayedSizes(controlId, sizes)
		return { onChange, state: () => b.controller.buttonClient.getState(controlId) }
	}

	/** The images of a button, as `<width>x<height>:<image>` */
	function imagesOf(state: LinkButtonState | undefined): string[] {
		return (state?.images ?? []).map((i) => `${i.width}x${i.height}:${i.dataUrl.replace('data:image/png;base64,', '')}`)
	}

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

	test('nothing is shared until the user says so', async () => {
		const button = showOnB('remote', location)
		await vi.waitFor(() => expect(button.state()?.status).toBe('denied'))
		// Not even sent, as A has said it doesn't share its buttons. A refusing a peer that sends anyway is tested in
		// Controller.test.ts
		b.controller.buttonClient.press('remote', true, 'surface')

		// Once shared, the button loads: everything sent before that has arrived, and nothing was pressed
		await shareButtons(a, bId, true)
		await vi.waitFor(() => expect(button.state()?.status).toBe('ok'))
		expect(a.controls.pressControl).not.toHaveBeenCalled()
	})

	test('a shared button is shown, redrawn, pressed, rotated and aborted over the link', async () => {
		await shareButtons(a, bId, true)
		const button = showOnB('remote', location)

		await vi.waitFor(() => expect(button.state()).toMatchObject({ status: 'ok', peerName: 'Studio A', pressed: false }))
		expect(imagesOf(button.state())).toEqual(['144x144:Studio A-1/0/0'])

		a.controller.onButtonDrawn(location, fakeRender('Studio A-redrawn', true))
		await vi.waitFor(() => expect(button.state()).toMatchObject({ pressed: true }))
		expect(imagesOf(button.state())).toEqual(['144x144:Studio A-redrawn'])

		b.controller.buttonClient.press('remote', true, 'surface')
		expect(b.controller.buttonClient.rotate('remote', -1, 'surface')).toBe(true)
		b.controller.buttonClient.abort('remote', true, 0)
		await vi.waitFor(() => {
			expect(a.controls.pressControl).toHaveBeenCalledWith('control-1/0/0', true, `link:${bId}:surface`)
			expect(a.controls.rotateControl).toHaveBeenCalledWith('control-1/0/0', -1, `link:${bId}:surface`)
			expect(a.abortControl).toHaveBeenCalledWith('control-1/0/0', true, 1)
		})
	})

	test('a button shown at other shapes is drawn by its peer at each of them, and redrawn at them together', async () => {
		await shareButtons(a, bId, true)
		const button = showOnB('remote', location, [
			{ width: 72, height: 72 },
			{ width: 200, height: 100 },
		])

		await vi.waitFor(() =>
			expect(imagesOf(button.state())).toEqual(['288x144:Studio A-1/0/0', '144x144:Studio A-1/0/0'])
		)
		// Served as its content alone, for B to decorate
		expect(a.displayedLocations.getSizes(location)).toEqual([
			{ width: 288, height: 144, contentOnly: true },
			{ width: 144, height: 144, contentOnly: true },
		])

		button.onChange.mockClear()
		a.controller.onButtonDrawn(location, fakeRender('Studio A-redrawn', true))
		await vi.waitFor(() =>
			expect(imagesOf(button.state())).toEqual(['288x144:Studio A-redrawn', '144x144:Studio A-redrawn'])
		)
		expect(button.onChange).toHaveBeenCalledTimes(1)
	})

	test('a remote button served onwards is subscribed to at the size it is served at', async () => {
		await shareButtons(a, bId, true)
		await shareButtons(b, aId, true)

		// A remote button on A, which nothing on A shows, showing B's button
		const locationOnA = { ...location, column: 1 }
		a.placeRemoteButton(locationOnA, 'remote-on-a')
		a.targetRemoteButton('remote-on-a', { peerId: bId, location })
		await vi.waitFor(async () => expect((await b.api.peerUsage({ peerId: aId })).buttons.oursUsedThere).toBe(0))

		// Once B shows it, as a strip, A subscribes to B's button at that shape. (B is then shown its own button back,
		// which is a loop, but that is tested elsewhere)
		showOnB('remote-on-b', locationOnA, [{ width: 200, height: 100 }])
		await vi.waitFor(() =>
			expect(b.displayedLocations.getSizes(location)).toEqual([{ width: 288, height: 144, contentOnly: true }])
		)
	})

	test('what is in use is counted on both installations', async () => {
		await shareButtons(a, bId, true)
		const button = showOnB('remote', location)
		showOnB('same', location)
		showOnB('other', { ...location, column: 1 })
		await vi.waitFor(() => expect(button.state()?.status).toBe('ok'))

		await vi.waitFor(async () => {
			expect((await a.api.peerUsage({ peerId: bId })).buttons).toEqual({ oursUsedThere: 2, theirsUsedHere: 0 })
			expect((await b.api.peerUsage({ peerId: aId })).buttons).toEqual({ oursUsedThere: 0, theirsUsedHere: 2 })
		})
	})

	test('stopping sharing applies straight away, releasing what was held', async () => {
		await shareButtons(a, bId, true)
		const button = showOnB('remote', location)
		await vi.waitFor(() => expect(button.state()?.status).toBe('ok'))
		b.controller.buttonClient.press('remote', true, 'surface')
		await vi.waitFor(() =>
			expect(a.controls.pressControl).toHaveBeenCalledWith('control-1/0/0', true, `link:${bId}:surface`)
		)

		await shareButtons(a, bId, false)
		expect(a.controls.pressControl).toHaveBeenLastCalledWith('control-1/0/0', false, `link:${bId}:surface`)
		await vi.waitFor(() => expect(button.state()?.status).toBe('denied'))
		expect((await a.api.peerUsage({ peerId: bId })).buttons.oursUsedThere).toBe(0)
	})

	test('a button linked back to the installation it shows is reported as a loop', async () => {
		await shareButtons(a, bId, true)
		await shareButtons(b, aId, true)

		// B shows A's button, at a location that A shows from B: each image would carry the other's
		const locationOnA = location
		const locationOnB = { ...location, column: 1 }
		b.placeRemoteButton(locationOnB, 'remote-on-b')
		a.placeRemoteButton(locationOnA, 'remote-on-a')

		const onB = showOnB('remote-on-b', locationOnA)
		await vi.waitFor(() => expect(onB.state()?.status).toBe('ok'))

		a.targetRemoteButton('remote-on-a', { peerId: bId, location: locationOnB })
		await vi.waitFor(() => expect(a.controller.buttonClient.getState('remote-on-a')?.status).toBe('loop'))
	})

	test('when an installation stops, the other sees it go offline', async () => {
		await a.stop()
		await vi.waitFor(async () => expect((await b.peers()).find((p) => p.id === aId)?.online).toBe(false))
	})
})

import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SurfacesDiscoveryUpdate } from '@companion-app/shared/Model/Surfaces.js'
import { getSatelliteServices, ServiceSurfaceDiscovery } from '../../lib/Surface/Discovery.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

// The real Bonjour opens mdns sockets, so its browsers are plain EventEmitters, driven by the tests
const hoisted = vi.hoisted(() => ({ instances: [] as any[] }))

vi.mock('@julusian/bonjour-service', async () => {
	const { EventEmitter } = await import('node:events')
	const { vi } = await import('vitest')

	class FakeBrowser extends EventEmitter {
		services: any[] = []
		expire = vi.fn()
		constructor(readonly filter: any) {
			super()
		}
	}

	class Bonjour {
		browsers: FakeBrowser[] = []
		destroy = vi.fn()
		find = vi.fn((filter: any) => {
			const browser = new FakeBrowser(filter)
			this.browsers.push(browser)
			return browser
		})
		constructor() {
			hoisted.instances.push(this)
		}
	}

	return { Bonjour }
})

const t = initTRPC.context<TrpcContext>().create()

function satellite(name: string, type: string, txt: Record<string, string> = {}) {
	return { name, fqdn: `${name}._${type}._tcp.local`, addresses: ['10.0.0.1'], port: 9999, txt }
}

function uiInfo(service: ReturnType<typeof satellite>) {
	return {
		id: service.fqdn,
		surfaceType: 'satellite',
		name: service.name,
		addresses: service.addresses,
		port: service.port,
		apiEnabled: service.txt.restEnabled === 'true',
	}
}

describe('ServiceSurfaceDiscovery', () => {
	let discovery: ServiceSurfaceDiscovery
	let received: SurfacesDiscoveryUpdate[]
	let iterator: AsyncIterator<SurfacesDiscoveryUpdate> | undefined

	function browser(type: string) {
		const found = hoisted.instances.at(-1).browsers.find((b: any) => b.filter.type === type)
		if (!found) throw new Error(`no browser for ${type}`)
		return found
	}
	const current = () => browser('comp-sat-app')
	const legacy = () => browser('companion-satellite')

	function up(target: any, service: ReturnType<typeof satellite>) {
		target.services.push(service)
		target.emit('up', service)
	}
	function down(target: any, service: ReturnType<typeof satellite>) {
		target.services = target.services.filter((s: any) => s !== service)
		target.emit('down', service)
	}

	/** Subscribe, returning the init value */
	async function subscribe(): Promise<SurfacesDiscoveryUpdate> {
		const caller = t.createCallerFactory(discovery.createTrpcRouter())(createMockTrpcContext())
		const iterable = (await caller.watchForSurfaces()) as AsyncIterable<SurfacesDiscoveryUpdate>
		const it = iterable[Symbol.asyncIterator]()
		iterator = it
		void (async () => {
			for (let next = await it.next(); !next.done; next = await it.next()) received.push(next.value)
		})().catch(() => null)
		return (await events())[0]
	}

	/** Wait for the subscription to receive, returning what was sent since the last call */
	async function events(): Promise<SurfacesDiscoveryUpdate[]> {
		await new Promise((resolve) => setTimeout(resolve, 10))
		return received.splice(0)
	}

	beforeEach(() => {
		hoisted.instances.length = 0
		received = []
		iterator = undefined
		discovery = new ServiceSurfaceDiscovery()
	})
	afterEach(() => {
		void iterator?.return?.()
		discovery.quit()
	})

	it('browses both the current and the legacy satellite types', () => {
		expect(hoisted.instances.at(-1).browsers.map((b: any) => b.filter)).toEqual([
			{ type: 'comp-sat-app', protocol: 'tcp' },
			{ type: 'companion-satellite', protocol: 'tcp' },
		])
	})

	it('lists satellites from both types, without one announced under both twice', async () => {
		const a = satellite('A', 'comp-sat-app')
		const aLegacy = satellite('A', 'companion-satellite')
		const b = satellite('B', 'companion-satellite')
		up(current(), a)
		up(legacy(), aLegacy)
		up(legacy(), b)

		expect(await subscribe()).toEqual({ type: 'init', infos: [uiInfo(a), uiInfo(b)] })
	})

	it('replaces a legacy satellite once it is announced under the current type, and back again', async () => {
		expect(await subscribe()).toEqual({ type: 'init', infos: [] })

		const aLegacy = satellite('A', 'companion-satellite')
		up(legacy(), aLegacy)
		expect(await events()).toEqual([{ type: 'update', info: uiInfo(aLegacy) }])

		const a = satellite('A', 'comp-sat-app')
		up(current(), a)
		expect(await events()).toEqual([
			{ type: 'update', info: uiInfo(a) },
			{ type: 'remove', itemId: aLegacy.fqdn },
		])

		down(current(), a)
		expect(await events()).toEqual([
			{ type: 'update', info: uiInfo(aLegacy) },
			{ type: 'remove', itemId: a.fqdn },
		])
	})

	it('removes a satellite that goes down', async () => {
		const a = satellite('A', 'comp-sat-app')
		up(current(), a)
		expect(await subscribe()).toEqual({ type: 'init', infos: [uiInfo(a)] })

		down(current(), a)
		expect(await events()).toEqual([{ type: 'remove', itemId: a.fqdn }])
	})

	it('sends a txt update only when it changes what is shown', async () => {
		const a = satellite('A', 'comp-sat-app')
		up(current(), a)
		expect(await subscribe()).toEqual({ type: 'init', infos: [uiInfo(a)] })

		const sameInfo = satellite('A', 'comp-sat-app', { other: 'x' })
		current().services = [sameInfo]
		current().emit('txt-update', sameInfo, a)
		expect(await events()).toEqual([])

		const restEnabled = satellite('A', 'comp-sat-app', { restEnabled: 'true' })
		current().services = [restEnabled]
		current().emit('txt-update', restEnabled, sameInfo)
		expect(await events()).toEqual([{ type: 'update', info: uiInfo(restEnabled) }])
	})
})

describe('getSatelliteServices', () => {
	it('prefers the current type over the legacy one for the same name', () => {
		const a = satellite('A', 'comp-sat-app') as any
		const aLegacy = satellite('A', 'companion-satellite') as any
		const b = satellite('B', 'companion-satellite') as any
		expect(getSatelliteServices([a], [aLegacy, b])).toEqual([a, b])
	})
})

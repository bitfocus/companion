import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { ClientBonjourEvent } from '@companion-app/shared/Model/Common.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { InstanceController } from '../../lib/Instance/Controller.js'
import { ServiceBonjourDiscovery } from '../../lib/Service/BonjourDiscovery.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// ── bonjour-service mock ──────────────────────────────────────────────────────
//
// The real Bonjour server opens mdns sockets, so we replace it with a fake whose
// browsers are plain EventEmitters. Tests drive discovery by emitting `up`/`down`/
// `txt-update`/`srv-update` on these browsers and reading what the tRPC subscription
// yields back to the client.

const hoisted = vi.hoisted(() => ({
	/** Every Bonjour instance ever constructed, newest last. */
	instances: [] as any[],
	/** When set, the next `new Bonjour()` throws this (simulates a launch failure). */
	constructError: null as Error | null,
}))

vi.mock('@julusian/bonjour-service', async () => {
	const { EventEmitter } = await import('node:events')
	const { vi } = await import('vitest')

	class FakeBrowser extends EventEmitter {
		services: any[] = []
		stop = vi.fn()
		filter: any
		constructor(filter: any) {
			super()
			this.filter = filter
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
			if (hoisted.constructError) throw hoisted.constructError
			hoisted.instances.push(this)
		}
	}

	return { Bonjour }
})

// ── helpers ───────────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

type FakeServer = {
	browsers: Array<{
		services: any[]
		stop: ReturnType<typeof vi.fn>
		filter: any
		emit: (event: string, ...args: any[]) => boolean
	}>
	find: ReturnType<typeof vi.fn>
	destroy: ReturnType<typeof vi.fn>
}

const DEFAULT_QUERIES = { q1: { type: 'http', protocol: 'tcp' } }

function createService(bonjourQueries: Record<string, any> = DEFAULT_QUERIES) {
	const userconfig = mockDeep<DataUserConfig>(mockOptions, {
		getKey: () => false,
	})
	const instanceController = mockDeep<InstanceController>(mockOptions, {
		getManifestForConnection: vi.fn().mockReturnValue({ bonjourQueries } as any),
	})

	const service = new ServiceBonjourDiscovery(userconfig, instanceController)
	const server = hoisted.instances.at(-1) as FakeServer | undefined

	return { service, server, instanceController, userconfig }
}

// function lastServer(): FakeServer {
// 	return hoisted.instances.at(-1) as FakeServer
// }

async function subscribe(
	service: ServiceBonjourDiscovery,
	input: { connectionId: string; queryId: string }
): Promise<SubscriptionTester<ClientBonjourEvent>> {
	const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
	const iterable = (await caller.watchQuery(input)) as AsyncIterable<ClientBonjourEvent>
	return new SubscriptionTester(iterable, { timeoutMs: 1000 })
}

/** Kick the subscription generator (creates the browser & subscribes) without unhandled rejections. */
async function kick(sub: SubscriptionTester<ClientBonjourEvent>): Promise<ClientBonjourEvent> {
	const p = sub.next()
	p.catch(() => {
		/* the test may never read this value (eg a `no services` subscription) */
	})
	return p
}

/** Wait until the browser at `idx` has been created by the (lazy) subscription generator. */
async function getBrowser(server: FakeServer, idx = 0): Promise<FakeServer['browsers'][number]> {
	for (let i = 0; i < 200; i++) {
		if (server.browsers.length > idx) return server.browsers[idx]
		await new Promise((r) => setTimeout(r, 5))
	}
	throw new Error(`browser[${idx}] was never created`)
}

const wait = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function makeSvc(overrides: Record<string, any> = {}): any {
	return {
		fqdn: 'My Service._http._tcp.local',
		name: 'My Service',
		type: 'http',
		subtypes: [],
		protocol: 'tcp',
		addresses: ['192.168.1.5'],
		host: 'host.local',
		port: 80,
		txt: {},
		rawTxt: undefined,
		referer: {} as any,
		ttl: 120,
		lastSeen: 0,
		...overrides,
	}
}

function expectedSvc(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		subId: 'conn1::q1',
		fqdn: 'My Service._http._tcp.local',
		name: 'My Service',
		port: 80,
		addresses: ['192.168.1.5'],
		...overrides,
	}
}

const INPUT = { connectionId: 'conn1', queryId: 'q1' }

describe('ServiceBonjourDiscovery', () => {
	beforeEach(() => {
		hoisted.instances.length = 0
		hoisted.constructError = null
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// ── lifecycle ────────────────────────────────────────────────────────────
	describe('lifecycle', () => {
		it('starts a Bonjour server on construction', () => {
			const { server } = createService()
			expect(server).toBeDefined()
			expect(hoisted.instances).toHaveLength(1)
		})

		it('listen() is idempotent while a server is already running', () => {
			const { service } = createService()
			expect(hoisted.instances).toHaveLength(1)
			;(service as any).listen()
			;(service as any).listen()
			expect(hoisted.instances).toHaveLength(1)
		})

		it('close() destroys the server and clears it', () => {
			const { service, server } = createService()
			;(service as any).close()
			expect(server!.destroy).toHaveBeenCalledTimes(1)
		})

		it('close() is a no-op when nothing is running', () => {
			const { service, server } = createService()
			;(service as any).close()
			;(service as any).close()
			expect(server!.destroy).toHaveBeenCalledTimes(1)
		})

		it('listen() after close() starts a fresh server', () => {
			const { service } = createService()
			;(service as any).close()
			;(service as any).listen()
			expect(hoisted.instances).toHaveLength(2)
		})

		it('survives a server that fails to launch', async () => {
			hoisted.constructError = new Error('mdns boom')
			const { server } = createService()
			// Construction swallows the error, leaving no running server
			expect(server).toBeUndefined()
			expect(hoisted.instances).toHaveLength(0)
		})
	})

	// ── session setup / validation ───────────────────────────────────────────
	describe('session setup', () => {
		it('starts a browser with the query filter', async () => {
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp' } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			expect(server!.find).toHaveBeenCalledTimes(1)
			expect(browser.filter).toEqual({
				type: 'http',
				protocol: 'tcp',
				port: undefined,
				txt: undefined,
				addressFamily: undefined,
			})

			// resolve the pending read so the subscription can be cleanly torn down
			browser.emit('up', makeSvc())
			await p
			await sub.cleanup()
		})

		it('passes port, txt and addressFamily through to the filter', async () => {
			const { service, server } = createService({
				q1: { type: 'osc', protocol: 'udp', port: 9000, txt: { model: 'x32' }, addressFamily: 'ipv6' },
			})
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			expect(browser.filter).toEqual({
				type: 'osc',
				protocol: 'udp',
				port: 9000,
				txt: { model: 'x32' },
				addressFamily: 'ipv6',
			})

			browser.emit('up', makeSvc({ port: 9000, addresses: ['fe80::1'] }))
			await p
			await sub.cleanup()
		})

		it('starts one browser per query when the query is an array', async () => {
			const { service, server } = createService({
				q1: [
					{ type: 'http', protocol: 'tcp' },
					{ type: 'https', protocol: 'tcp' },
				],
			})
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser1 = await getBrowser(server!, 1)
			expect(server!.find).toHaveBeenCalledTimes(2)
			expect(server!.browsers[0].filter.type).toBe('http')
			expect(server!.browsers[1].filter.type).toBe('https')

			browser1.emit('up', makeSvc())
			await p
			await sub.cleanup()
		})

		it('throws when the manifest has no such query', async () => {
			const { service } = createService({})
			const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
			const iterable = (await caller.watchQuery(INPUT)) as AsyncIterable<ClientBonjourEvent>
			await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow('Missing bonjour query')
		})

		it('throws when the connection manifest is missing', async () => {
			const { service, instanceController } = createService()
			;(instanceController.getManifestForConnection as any).mockReturnValue(undefined)
			const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
			const iterable = (await caller.watchQuery(INPUT)) as AsyncIterable<ClientBonjourEvent>
			await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow('Missing bonjour query')
		})

		it('rejects a query with an empty type', async () => {
			const { service } = createService({ q1: { type: '', protocol: 'tcp' } })
			const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
			const iterable = (await caller.watchQuery(INPUT)) as AsyncIterable<ClientBonjourEvent>
			await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow('Invalid type for bonjour query')
		})

		it('rejects a query with an empty protocol', async () => {
			const { service } = createService({ q1: { type: 'http', protocol: '' } })
			const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
			const iterable = (await caller.watchQuery(INPUT)) as AsyncIterable<ClientBonjourEvent>
			await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow('Invalid protocol for bonjour query')
		})

		it('throws when the bonjour server is not running', async () => {
			const { service } = createService()
			;(service as any).close()
			const caller = t.createCallerFactory(service.createTrpcRouter())(testCtx)
			const iterable = (await caller.watchQuery(INPUT)) as AsyncIterable<ClientBonjourEvent>
			await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow('Bonjour not running')
		})
	})

	// ── discovery / convertService filtering ──────────────────────────────────
	describe('service conversion', () => {
		it('emits an `up` with the converted service when one appears', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc())

			expect(await p).toEqual({ type: 'up', service: expectedSvc() })
			await sub.cleanup()
		})

		it('keeps only ipv4 addresses by default', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ addresses: ['192.168.1.5', 'fe80::1', '10.0.0.1'] }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ addresses: ['192.168.1.5', '10.0.0.1'] }) })
			await sub.cleanup()
		})

		it('keeps only ipv6 addresses when addressFamily is ipv6', async () => {
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp', addressFamily: 'ipv6' } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ addresses: ['192.168.1.5', 'fe80::1'] }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ addresses: ['fe80::1'] }) })
			await sub.cleanup()
		})

		it('keeps both families when addressFamily is ipv4+6', async () => {
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp', addressFamily: 'ipv4+6' } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ addresses: ['192.168.1.5', 'fe80::1'] }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ addresses: ['192.168.1.5', 'fe80::1'] }) })
			await sub.cleanup()
		})

		it('includes a service whose port matches the port filter', async () => {
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp', port: 80 } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ port: 80 }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ port: 80 }) })
			await sub.cleanup()
		})

		it('does not emit anything for a fresh service that fails the address filter', async () => {
			// A brand-new `up` that fails the filter was never surfaced, so it must produce no event
			// (in particular, no phantom `down` for an fqdn the client never saw).
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ fqdn: 'v6._http._tcp.local', addresses: ['fe80::1'] }))
			// the first value the client receives is the next, matching, service
			browser.emit('up', makeSvc())

			expect(await p).toEqual({ type: 'up', service: expectedSvc() })
			await sub.cleanup()
		})

		it('does not emit anything for a fresh service that fails the port filter', async () => {
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp', port: 80 } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ fqdn: 'wrong._http._tcp.local', port: 9999 }))
			browser.emit('up', makeSvc({ port: 80 }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ port: 80 }) })
			await sub.cleanup()
		})

		it('does NOT apply a port filter of 0 (falsy-check edge case)', async () => {
			// `if (filter.port && ...)` treats port 0 as "no filter", so a service on any port matches.
			const { service, server } = createService({ q1: { type: 'http', protocol: 'tcp', port: 0 } })
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc({ port: 1234 }))

			expect(await p).toEqual({ type: 'up', service: expectedSvc({ port: 1234 }) })
			await sub.cleanup()
		})
	})

	// ── down events ──────────────────────────────────────────────────────────
	describe('down events', () => {
		it('forwards a `down` event to the client', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc())
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })

			browser.emit('down', makeSvc())
			expect(await sub.next()).toEqual({ type: 'down', fqdn: 'My Service._http._tcp.local' })

			await sub.cleanup()
		})
	})

	// ── txt-update / srv-update dedup ─────────────────────────────────────────
	describe('updates', () => {
		it('does not re-emit when only an unsurfaced field (txt) changes', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			const original = makeSvc({ txt: { a: '1' } })
			browser.emit('up', original)
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })

			// Only txt changed (not surfaced to the client) -> no emit. Proven by the next
			// real change being the very next value the client receives.
			browser.emit('txt-update', makeSvc({ txt: { a: '2' } }), original)
			browser.emit('srv-update', makeSvc({ port: 81, txt: { a: '2' } }), makeSvc({ txt: { a: '2' } }))

			expect(await sub.next()).toEqual({ type: 'up', service: expectedSvc({ port: 81 }) })
			await sub.cleanup()
		})

		it('re-emits an `up` (same fqdn) when a surfaced field changes', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			const original = makeSvc()
			browser.emit('up', original)
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })

			browser.emit('srv-update', makeSvc({ port: 8080 }), original)
			expect(await sub.next()).toEqual({ type: 'up', service: expectedSvc({ port: 8080 }) })

			await sub.cleanup()
		})

		it('emits a `down` when an update makes the service stop matching the filter', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			const original = makeSvc()
			browser.emit('up', original)
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })

			// Now only has ipv6 addresses -> fails the default ipv4 filter -> down
			browser.emit('srv-update', makeSvc({ addresses: ['fe80::1'] }), original)
			expect(await sub.next()).toEqual({ type: 'down', fqdn: 'My Service._http._tcp.local' })

			await sub.cleanup()
		})

		it('does not emit when both the old and new service fail the filter', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc())
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })

			// both ipv6-only (null -> null), so no emit; the matching event after it is the next value
			const v6a = makeSvc({ fqdn: 'other._http._tcp.local', addresses: ['fe80::1'] })
			const v6b = makeSvc({ fqdn: 'other._http._tcp.local', addresses: ['fe80::2'] })
			browser.emit('srv-update', v6b, v6a)
			browser.emit('srv-update', makeSvc({ port: 90 }), makeSvc())

			expect(await sub.next()).toEqual({ type: 'up', service: expectedSvc({ port: 90 }) })
			await sub.cleanup()
		})
	})

	// ── session sharing & initial data ─────────────────────────────────────────
	describe('session sharing', () => {
		it('replays the current services to a newly joined subscriber and shares the browser', async () => {
			const { service, server } = createService()

			const sub1 = await subscribe(service, INPUT)
			const p1 = kick(sub1)
			const browser = await getBrowser(server!)
			const svc = makeSvc()
			browser.services.push(svc) // the library keeps a record of live services
			browser.emit('up', svc)
			expect(await p1).toEqual({ type: 'up', service: expectedSvc() })

			// Second client with identical input joins the SAME session
			const sub2 = await subscribe(service, INPUT)
			const p2 = sub2.next()
			// Receives the already-known service via the initial-data replay
			expect(await p2).toEqual({ type: 'up', service: expectedSvc() })
			// No second browser was started
			expect(server!.find).toHaveBeenCalledTimes(1)

			await sub1.cleanup()
			await sub2.cleanup()
		})

		it('uses separate sessions/browsers for different queryIds', async () => {
			const { service, server } = createService({
				q1: { type: 'http', protocol: 'tcp' },
				q2: { type: 'https', protocol: 'tcp' },
			})

			const sub1 = await subscribe(service, { connectionId: 'conn1', queryId: 'q1' })
			const p1 = kick(sub1)
			const browser0 = await getBrowser(server!, 0)

			const sub2 = await subscribe(service, { connectionId: 'conn1', queryId: 'q2' })
			const p2 = kick(sub2)
			const browser1 = await getBrowser(server!, 1)

			expect(server!.find).toHaveBeenCalledTimes(2)

			browser0.emit('up', makeSvc())
			browser1.emit('up', makeSvc())
			await p1
			await p2
			await sub1.cleanup()
			await sub2.cleanup()
		})

		it('a `down` from one query in a multi-query session removes a service still seen by another', async () => {
			// Potential bug: both browsers in the session discover the same fqdn. When ONE of them
			// emits `down`, the client is told the service is gone even though the other browser still
			// considers it up. The down handler emits unconditionally, without consulting the other
			// browser's `services`. Documented here so a future change is a deliberate one.
			const { service, server } = createService({
				q1: [
					{ type: 'http', protocol: 'tcp' },
					{ type: 'https', protocol: 'tcp' },
				],
			})
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)

			const browserA = await getBrowser(server!, 0)
			const browserB = await getBrowser(server!, 1)

			browserA.emit('up', makeSvc())
			expect(await p).toEqual({ type: 'up', service: expectedSvc() })
			browserB.emit('up', makeSvc())
			expect(await sub.next()).toEqual({ type: 'up', service: expectedSvc() })

			// browserB drops it -> client gets a `down` even though browserA still has it
			browserB.emit('down', makeSvc())
			expect(await sub.next()).toEqual({ type: 'down', fqdn: 'My Service._http._tcp.local' })

			await sub.cleanup()
		})
	})

	// ── teardown ───────────────────────────────────────────────────────────────
	describe('session teardown', () => {
		it('stops the browser shortly after the last subscriber leaves', async () => {
			const { service, server } = createService()
			const sub = await subscribe(service, INPUT)
			const p = kick(sub)
			const browser = await getBrowser(server!)
			browser.emit('up', makeSvc())
			await p

			await sub.cleanup()
			// Cleanup is deferred (restarting a query immediately fails), so not stopped yet
			expect(browser.stop).not.toHaveBeenCalled()

			await wait(600)
			expect(browser.stop).toHaveBeenCalledTimes(1)
		})

		it('keeps the browser running while another subscriber is still attached', async () => {
			const { service, server } = createService()

			// Bring both subscribers up and drive each into its live-changes loop (so teardown
			// deterministically removes its listener) by delivering an event through the stream.
			const sub1 = await subscribe(service, INPUT)
			const p1 = kick(sub1)
			const browser = await getBrowser(server!)

			const sub2 = await subscribe(service, INPUT)
			const p2 = kick(sub2)

			browser.emit('up', makeSvc())
			await p1
			await p2

			await sub1.cleanup()
			await wait(600)
			// sub2 still attached -> browser must stay alive
			expect(browser.stop).not.toHaveBeenCalled()

			await sub2.cleanup()
			await wait(600)
			expect(browser.stop).toHaveBeenCalledTimes(1)
		})
	})
})

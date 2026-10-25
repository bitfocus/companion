import { initTRPC } from '@trpc/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import { BROKEN_ROWS_TABLE } from '../../lib/Data/Tables/ParsedTableViewBase.js'
import { SurfaceOutboundController } from '../../lib/Surface/Outbound.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

// The real discovery browses bonjour on construction
vi.mock('../../lib/Surface/Discovery.js', async () => {
	const { router } = await import('../../lib/UI/TRPC.js')
	return {
		ServiceSurfaceDiscovery: class {
			getInfoForConnectionId = vi.fn()
			quit = vi.fn()
			createTrpcRouter() {
				return router({})
			}
		},
	}
})

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

const TABLE = 'surfaces_remote'

function makeSurface(overrides: Partial<OutboundSurfaceInfo> = {}): OutboundSurfaceInfo {
	return {
		id: 'surf1',
		type: 'plugin',
		enabled: true,
		displayName: 'Surface',
		moduleId: 'mod',
		instanceId: 'inst',
		config: { host: '10.0.0.1' },
		collectionId: null,
		sortOrder: 0,
		...overrides,
	}
}

const openControllers: { db: DataDatabase; controller: SurfaceOutboundController }[] = []

function createController(rows: Record<string, unknown> = {}) {
	const db = new DataDatabase(':memory:', () => {})
	const table = db.getTableView<Record<string, any>>(TABLE)
	for (const [id, row] of Object.entries(rows)) table.set(id, row)

	const controller = new SurfaceOutboundController(db)

	const clientInfo = vi.fn()
	controller.events.on('clientInfo', clientInfo)
	const startStop = vi.fn()
	controller.events.on('startStop:inst', startStop)

	controller.init()

	const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
	const discovery = vi.mocked(controller.discovery)

	openControllers.push({ db, controller })

	return { db, table, controller, caller, discovery, clientInfo, startStop }
}

/** Ids of surfaces started or stopped, in order, as `+id` / `-id` */
function startStopIds(startStop: ReturnType<typeof vi.fn>): string[] {
	return startStop.mock.calls.map(([info]) => `${info.enabled ? '+' : '-'}${info.id}`)
}

afterEach(() => {
	for (const { db, controller } of openControllers.splice(0)) {
		controller.quit()
		db.close()
	}
})

describe('SurfaceOutboundController', () => {
	describe('init', () => {
		test('loads surfaces, filling in defaults for old rows', () => {
			const { controller } = createController({
				old: { id: 'old', type: 'plugin', moduleId: 'mod', instanceId: 'inst' },
			})

			expect(controller.getById('old')).toEqual({
				id: 'old',
				type: 'plugin',
				enabled: true,
				displayName: '',
				moduleId: 'mod',
				instanceId: 'inst',
				config: {},
				collectionId: null,
				sortOrder: 0,
			})
		})

		test('moves invalid rows to the broken rows table', () => {
			const { db, controller } = createController({
				good: makeSurface({ id: 'good' }),
				bad: { id: 'bad', type: 'elgato' },
			})

			expect(Object.keys(controller.exportAll())).toEqual(['good'])
			expect(Object.keys(db.getTableView(TABLE).all())).toEqual(['good'])

			const broken = Object.values(db.getTableView<Record<string, any>>(BROKEN_ROWS_TABLE).all())
			expect(broken).toEqual([expect.objectContaining({ table: TABLE, rowId: 'bad' })])
		})

		test('starts only the enabled surfaces', () => {
			const { startStop } = createController({
				on: makeSurface({ id: 'on' }),
				off: makeSurface({ id: 'off', enabled: false }),
			})

			expect(startStopIds(startStop)).toEqual(['+on'])
		})
	})

	describe('addOutboundConnection', () => {
		test('stores the normalised surface, persists it and starts it', () => {
			const { controller, table, clientInfo, startStop } = createController()

			const partial: any = { id: 'abc', type: 'plugin', moduleId: 'mod', instanceId: 'inst' }
			controller.addOutboundConnection(partial)

			const expected = makeSurface({ id: 'abc', displayName: '', config: {} })
			expect(controller.getById('abc')).toEqual(expected)
			expect(table.get('abc')).toEqual(expected)
			expect(clientInfo).toHaveBeenCalledWith({ type: 'add', itemId: 'abc', info: expected })
			expect(startStopIds(startStop)).toEqual(['+abc'])
		})

		test('rejects a duplicate id', () => {
			const { controller } = createController({ surf1: makeSurface() })

			expect(() => controller.addOutboundConnection(makeSurface({ displayName: 'Other' }))).toThrow(/already exists/)
			expect(controller.getById('surf1')?.displayName).toBe('Surface')
		})

		test('does not track an invalid surface', () => {
			const { controller, table, clientInfo, startStop } = createController()

			const invalid: any = { id: 'abc', type: 'plugin', moduleId: 'mod' }
			expect(() => controller.addOutboundConnection(invalid)).toThrow()

			expect(controller.getById('abc')).toBeUndefined()
			expect(table.get('abc')).toBeUndefined()
			expect(clientInfo).not.toHaveBeenCalled()
			expect(startStop).not.toHaveBeenCalled()
		})
	})

	describe('add', () => {
		function supportRemote(controller: SurfaceOutboundController, configMatchesExpression: string | null = null) {
			controller.updateDefaultConfigForSurfaceInstance('inst', 'mod', {
				configFields: [
					{ id: 'host', type: 'textinput', label: 'Host', default: '127.0.0.1' },
					{ id: 'note', type: 'static-text', label: 'Note', value: '' },
				] as any,
				configMatchesExpression,
			})
		}

		test('fails for an instance without remote support', async () => {
			const { caller } = createController()

			expect(await caller.add({ instanceId: 'inst' })).toEqual({
				ok: false,
				error: 'Surface integration does not support remote connections',
			})
		})

		test('fails once remote support is withdrawn', async () => {
			const { controller, caller } = createController()
			supportRemote(controller)
			controller.updateDefaultConfigForSurfaceInstance('inst', 'mod', null)

			expect((await caller.add({ instanceId: 'inst' })).ok).toBe(false)
		})

		test('creates a surface from the default config', async () => {
			const { controller, caller, startStop } = createController()
			supportRemote(controller)

			const result = await caller.add({ instanceId: 'inst' })
			if (!result.ok) throw new Error(result.error)

			expect(controller.getById(result.id)).toEqual(
				makeSurface({
					id: result.id,
					displayName: 'New Remote Surface',
					config: { host: '127.0.0.1' },
					sortOrder: expect.any(Number),
				})
			)
			expect(startStopIds(startStop)).toEqual([`+${result.id}`])
		})

		test('fails for an unknown discovered connection', async () => {
			const { controller, caller, discovery } = createController()
			supportRemote(controller)
			discovery.getInfoForConnectionId.mockReturnValue(undefined)

			expect(await caller.add({ instanceId: 'inst', connectionId: 'conn' })).toEqual({
				ok: false,
				error: 'Unknown connection',
			})
			expect(discovery.getInfoForConnectionId).toHaveBeenCalledWith('inst', 'conn')
		})

		test('creates a surface from a discovered connection', async () => {
			const { controller, caller, discovery } = createController()
			supportRemote(controller)
			discovery.getInfoForConnectionId.mockReturnValue({
				displayName: 'Found Panel',
				config: { host: '10.0.0.9' },
			} as any)

			const result = await caller.add({ instanceId: 'inst', connectionId: 'conn' })
			if (!result.ok) throw new Error(result.error)

			expect(controller.getById(result.id)).toMatchObject({
				displayName: 'Found Panel',
				config: { host: '10.0.0.9' },
			})
		})

		test('rejects a discovered connection matching an existing surface', async () => {
			const { controller, caller, discovery } = createController({
				surf1: makeSurface({ config: { host: '10.0.0.9' } }),
			})
			supportRemote(controller, '$(objA:host) == $(objB:host)')
			discovery.getInfoForConnectionId.mockReturnValue({
				displayName: 'Found Panel',
				config: { host: '10.0.0.9' },
			} as any)

			expect(await caller.add({ instanceId: 'inst', connectionId: 'conn' })).toEqual({
				ok: false,
				error: 'A connection with matching configuration already exists',
			})
			expect(Object.keys(controller.exportAll())).toEqual(['surf1'])
		})

		test('allows a discovered connection not matching an existing surface', async () => {
			const { controller, caller, discovery } = createController({
				surf1: makeSurface({ config: { host: '10.0.0.1' } }),
			})
			supportRemote(controller, '$(objA:host) == $(objB:host)')
			discovery.getInfoForConnectionId.mockReturnValue({
				displayName: 'Found Panel',
				config: { host: '10.0.0.9' },
			} as any)

			expect((await caller.add({ instanceId: 'inst', connectionId: 'conn' })).ok).toBe(true)
			expect(Object.keys(controller.exportAll())).toHaveLength(2)
		})

		test('a new surface is sorted after the others in the root', async () => {
			const { controller, caller } = createController({
				root: makeSurface({ id: 'root', sortOrder: 3 }),
				grouped: makeSurface({ id: 'grouped', collectionId: 'col', sortOrder: 9 }),
			})
			supportRemote(controller)

			const result = await caller.add({ instanceId: 'inst' })
			if (!result.ok) throw new Error(result.error)

			expect(controller.getById(result.id)).toMatchObject({ collectionId: null, sortOrder: 4 })
		})

		test('the new surface does not share the default config object', async () => {
			const { controller, caller } = createController()
			supportRemote(controller)

			const first = await caller.add({ instanceId: 'inst' })
			if (!first.ok) throw new Error(first.error)
			controller.getById(first.id)!.config.host = 'changed'

			const second = await caller.add({ instanceId: 'inst' })
			if (!second.ok) throw new Error(second.error)
			expect(controller.getById(second.id)!.config).toEqual({ host: '127.0.0.1' })
		})
	})

	describe('remove', () => {
		test('removes, unpersists and stops the surface', async () => {
			const { controller, caller, table, clientInfo, startStop } = createController({ surf1: makeSurface() })

			await caller.remove({ id: 'surf1' })

			expect(controller.getById('surf1')).toBeUndefined()
			expect(table.get('surf1')).toBeUndefined()
			expect(clientInfo).toHaveBeenCalledWith({ type: 'remove', itemId: 'surf1' })
			expect(startStopIds(startStop)).toEqual(['+surf1', '-surf1'])
		})

		test('ignores an unknown id', async () => {
			const { caller, clientInfo } = createController()

			await expect(caller.remove({ id: 'nope' })).resolves.toBeUndefined()
			expect(clientInfo).not.toHaveBeenCalled()
		})
	})

	describe('setEnabled', () => {
		test('disables and re-enables, persisting each change', async () => {
			const { controller, caller, table, startStop } = createController({ surf1: makeSurface() })

			await caller.setEnabled({ id: 'surf1', enabled: false })
			expect(controller.getById('surf1')?.enabled).toBe(false)
			expect(table.get('surf1')?.enabled).toBe(false)

			await caller.setEnabled({ id: 'surf1', enabled: true })
			expect(table.get('surf1')?.enabled).toBe(true)

			expect(startStopIds(startStop)).toEqual(['+surf1', '-surf1', '+surf1'])
		})

		test('does not restart a surface already in that state', () => {
			const { controller, startStop } = createController({ surf1: makeSurface() })

			expect(controller.setOutboundEnabled('surf1', true)).toBe(true)
			expect(startStopIds(startStop)).toEqual(['+surf1'])
		})

		test('fails for an unknown id', async () => {
			const { controller, caller } = createController()

			expect(controller.setOutboundEnabled('nope', true)).toBe(false)
			await expect(caller.setEnabled({ id: 'nope', enabled: true })).rejects.toThrow('Surface not found')
		})
	})

	describe('saveConfig', () => {
		test('restarts the surface when its config changes', async () => {
			const { controller, caller, table, clientInfo, startStop } = createController({ surf1: makeSurface() })

			await caller.saveConfig({ id: 'surf1', name: 'Renamed', config: { host: '10.0.0.2' } })

			const expected = makeSurface({ displayName: 'Renamed', config: { host: '10.0.0.2' } })
			expect(controller.getById('surf1')).toEqual(expected)
			expect(table.get('surf1')).toEqual(expected)
			expect(clientInfo).toHaveBeenCalledWith({ type: 'add', itemId: 'surf1', info: expected })
			expect(startStopIds(startStop)).toEqual(['+surf1', '-surf1', '+surf1'])
			expect(startStop.mock.calls[2][0].config).toEqual({ host: '10.0.0.2' })
		})

		test('does not restart when only the name changes', async () => {
			const { caller, table, startStop } = createController({ surf1: makeSurface() })

			await caller.saveConfig({ id: 'surf1', name: 'Renamed', config: { host: '10.0.0.1' } })

			expect(table.get('surf1')?.displayName).toBe('Renamed')
			expect(startStopIds(startStop)).toEqual(['+surf1'])
		})

		test('does not start a disabled surface', async () => {
			const { caller, startStop } = createController({ surf1: makeSurface({ enabled: false }) })

			await caller.saveConfig({ id: 'surf1', name: 'Renamed', config: { host: '10.0.0.2' } })

			expect(startStop).not.toHaveBeenCalled()
		})

		test('fails for an unknown id', async () => {
			const { caller } = createController()

			await expect(caller.saveConfig({ id: 'nope', name: '', config: {} })).rejects.toThrow('Remote Surface not found')
		})
	})

	describe('collections', () => {
		async function createWithCollection(enabled: boolean) {
			const ctx = createController()
			const collectionId = await ctx.caller.collections.add({ collectionName: 'Group' })
			if (!enabled) await ctx.caller.collections.setEnabled({ collectionId, enabled: false })

			ctx.controller.addOutboundConnection(makeSurface({ id: 'grouped', collectionId }))
			ctx.controller.addOutboundConnection(makeSurface({ id: 'root', sortOrder: 4 }))

			return { ...ctx, collectionId }
		}

		test('a collection saved before collections could be disabled is enabled', () => {
			const db = new DataDatabase(':memory:', () => {})
			db.getTableView<Record<string, any>>('surfaces_remote_collections').set('legacy', {
				id: 'legacy',
				label: 'Old',
				sortOrder: 0,
			})
			db.getTableView<Record<string, any>>(TABLE).set('grouped', makeSurface({ id: 'grouped', collectionId: 'legacy' }))

			const controller = new SurfaceOutboundController(db)
			openControllers.push({ db, controller })
			controller.init()

			expect(controller.getAllEnabledConnectionsForInstance('inst').map((s) => s.id)).toEqual(['grouped'])
		})

		test('a surface in a disabled collection is not started', async () => {
			const { controller, startStop } = await createWithCollection(false)

			expect(startStopIds(startStop)).toEqual(['+root'])
			expect(controller.getAllEnabledConnectionsForInstance('inst').map((s) => s.id)).toEqual(['root'])
		})

		test('toggling a collection starts and stops its surfaces', async () => {
			const { caller, collectionId, startStop } = await createWithCollection(true)

			await caller.collections.setEnabled({ collectionId, enabled: false })
			await caller.collections.setEnabled({ collectionId, enabled: true })

			expect(startStopIds(startStop)).toEqual(['+grouped', '+root', '-grouped', '+grouped'])
		})

		test('removing a collection moves its surfaces to the end of the root', async () => {
			const { controller, caller, collectionId, clientInfo, startStop } = await createWithCollection(false)
			clientInfo.mockClear()

			await caller.collections.remove({ collectionId })

			const moved = makeSurface({ id: 'grouped', collectionId: null, sortOrder: 5 })
			expect(controller.getById('grouped')).toEqual(moved)
			expect(clientInfo).toHaveBeenCalledWith({ type: 'add', itemId: 'grouped', info: moved })
			expect(startStopIds(startStop)).toEqual(['+root', '+grouped'])
		})
	})

	describe('reorder', () => {
		function createThree() {
			return createController({
				a: makeSurface({ id: 'a', sortOrder: 0 }),
				b: makeSurface({ id: 'b', sortOrder: 1 }),
				c: makeSurface({ id: 'c', sortOrder: 2 }),
			})
		}

		function orderOf(controller: SurfaceOutboundController): string[] {
			return Object.values(controller.exportAll())
				.sort((x, y) => x.sortOrder - y.sortOrder)
				.map((s) => s.id)
		}

		test('moves a surface to the drop index, persisting the new orders', async () => {
			const { controller, caller, table } = createThree()

			expect(await caller.reorder({ collectionId: null, connectionId: 'c', dropIndex: 0 })).toBe(true)

			expect(orderOf(controller)).toEqual(['c', 'a', 'b'])
			expect(table.get('c')?.sortOrder).toBe(0)
			expect(table.get('b')?.sortOrder).toBe(2)
		})

		test('a negative drop index moves to the end', async () => {
			const { controller, caller } = createThree()

			await caller.reorder({ collectionId: null, connectionId: 'a', dropIndex: -1 })

			expect(orderOf(controller)).toEqual(['b', 'c', 'a'])
		})

		test('only emits updates for surfaces whose order changed', async () => {
			const { caller, clientInfo } = createThree()

			await caller.reorder({ collectionId: null, connectionId: 'b', dropIndex: 2 })

			expect(clientInfo.mock.calls.map(([update]) => update.itemId).sort()).toEqual(['b', 'c'])
		})

		test('moves a surface into a collection', async () => {
			const { controller, caller, table, startStop } = createThree()
			const collectionId = await caller.collections.add({ collectionName: 'Group' })
			await caller.collections.setEnabled({ collectionId, enabled: false })

			expect(await caller.reorder({ collectionId, connectionId: 'b', dropIndex: 0 })).toBe(true)

			expect(controller.getById('b')).toMatchObject({ collectionId, sortOrder: 0 })
			expect(table.get('b')).toMatchObject({ collectionId, sortOrder: 0 })
			// The collection is disabled, so the move stops it
			expect(startStopIds(startStop).slice(3)).toEqual(['-b'])
		})

		test('fails for an unknown surface or collection', async () => {
			const { caller } = createThree()

			expect(await caller.reorder({ collectionId: null, connectionId: 'nope', dropIndex: 0 })).toBe(false)
			expect(await caller.reorder({ collectionId: 'nope', connectionId: 'a', dropIndex: 0 })).toBe(false)
		})
	})

	describe('instance helpers', () => {
		test('getAllEnabledConnectionsForInstance only returns running surfaces of that instance', () => {
			const { controller } = createController({
				on: makeSurface({ id: 'on' }),
				off: makeSurface({ id: 'off', enabled: false }),
				other: makeSurface({ id: 'other', instanceId: 'other-inst' }),
			})

			expect(controller.getAllEnabledConnectionsForInstance('inst').map((s) => s.id)).toEqual(['on'])
		})

		test('removeAllForSurfaceInstance removes only that instance', () => {
			const { controller, table, clientInfo } = createController({
				mine: makeSurface({ id: 'mine' }),
				other: makeSurface({ id: 'other', instanceId: 'other-inst' }),
			})

			controller.removeAllForSurfaceInstance('inst')

			expect(Object.keys(controller.exportAll())).toEqual(['other'])
			expect(Object.keys(table.all())).toEqual(['other'])
			expect(clientInfo).toHaveBeenCalledWith({ type: 'remove', itemId: 'mine' })
		})

		test('removeAllForSurfaceInstance stops the removed surfaces', () => {
			const { controller, startStop } = createController({ mine: makeSurface({ id: 'mine' }) })

			controller.removeAllForSurfaceInstance('inst')

			expect(startStopIds(startStop)).toEqual(['+mine', '-mine'])

			// Its id is no longer tracked as running, so it would start again if re-added
			controller.addOutboundConnection(makeSurface({ id: 'mine' }))
			expect(startStopIds(startStop)).toEqual(['+mine', '-mine', '+mine'])
		})
	})

	test('reset stops and clears everything', () => {
		const { controller, table, clientInfo, startStop } = createController({
			surf1: makeSurface(),
			off: makeSurface({ id: 'off', enabled: false }),
		})

		controller.reset()

		expect(startStopIds(startStop)).toEqual(['+surf1', '-surf1'])
		expect(controller.getAllEnabledConnectionsForInstance('inst')).toEqual([])

		expect(controller.exportAll()).toEqual({})
		expect(table.all()).toEqual({})
		expect(clientInfo).toHaveBeenCalledWith({ type: 'init', items: {} })
	})

	test('watch streams the initial state then changes', async () => {
		const { controller, caller } = createController({ surf1: makeSurface() })

		const subscription = new SubscriptionTester(await caller.watch())
		await subscription.expectValue({ type: 'init', items: { surf1: makeSurface() } })

		controller.setOutboundEnabled('surf1', false)
		await subscription.expectValue({ type: 'add', itemId: 'surf1', info: makeSurface({ enabled: false }) })

		await subscription.cleanup()
	})
})

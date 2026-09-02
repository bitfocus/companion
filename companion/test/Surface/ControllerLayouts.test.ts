import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type {
	ClientSurfaceButtonSizesItem,
	ClientSurfaceLayoutItem,
	SurfaceConfig,
	SurfaceLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import { SurfaceController } from '../../lib/Surface/Controller.js'
import type { SatelliteDeviceInfo } from '../../lib/Surface/IP/Satellite.js'
import type { SurfaceHandlerDependencies } from '../../lib/Surface/Types.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

class TestDatabase extends DataStoreBase<any> {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

const neoLayout: SurfaceLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 96, h: 96 } },
		infoBar: { bitmap: { w: 248, h: 58 } },
	},
	controls: {
		'0/0': { row: 0, column: 0 },
		'1/0': { row: 1, column: 0, stylePreset: 'infoBar' },
	},
}

function makeStoredConfig(partial: Partial<SurfaceConfig>): SurfaceConfig {
	return {
		config: { brightness: 100, rotation: 0, xOffset: 0, yOffset: 0, groupId: null },
		groupConfig: {
			name: '',
			last_page_id: '1',
			startup_page_id: '1',
			use_last_page: true,
			never_lock: false,
		},
		groupId: null,
		type: 'Stream Deck Neo',
		integrationType: 'satellite',
		gridSize: { columns: 1, rows: 2 },
		layout: undefined,
		...partial,
	}
}

function createController() {
	const db = new TestDatabase()
	const deps = mockDeep<SurfaceHandlerDependencies>({
		fallbackMockImplementation: () => undefined,
	})
	// The controller reads these while opening a surface
	deps.userconfig.getKey.mockImplementation((key: string) => {
		if (key === 'gridSize') return { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
		return undefined
	})
	deps.pageStore.getFirstPageId.mockReturnValue('page1')

	const controller = new SurfaceController(db as any, deps)

	return { controller, db }
}

function satelliteDeviceInfo(overrides: Partial<SatelliteDeviceInfo> = {}): SatelliteDeviceInfo {
	return {
		connectionId: 'conn1',
		deviceId: 'dev1',
		serial: 'dev1',
		serialIsUnique: true,
		productName: 'Stream Deck Neo',
		socket: { remoteAddress: '1.2.3.4', write: vi.fn(), sendMessage: vi.fn() } as any,
		gridSize: { columns: 1, rows: 2 },
		supportsBrightness: true,
		transferVariables: [],
		supportsLockedState: false,
		surfaceManifestFromClient: true,
		surfaceManifest: neoLayout,
		configFields: undefined,
		canChangePage: undefined,
		bitmapFormat: 'rgb',
		...overrides,
	}
}

describe('SurfaceController layouts', () => {
	let controller: SurfaceController
	let db: TestDatabase

	beforeEach(() => {
		;({ controller, db } = createController())
	})

	test('has nothing to report with no surfaces', () => {
		expect(controller.getSurfaceLayouts()).toEqual({})
		expect(controller.getSurfaceButtonSizes()).toEqual({})
	})

	test('reports the stored layout of an offline surface', () => {
		db.getTableView('surfaces').set('offline1', makeStoredConfig({ layout: neoLayout }))

		const layouts = controller.getSurfaceLayouts()

		expect(layouts.offline1).toEqual({
			id: 'offline1',
			type: 'Stream Deck Neo',
			displayName: 'Stream Deck Neo (offline1)',
			isConnected: false,
			layout: neoLayout,
		})
	})

	test('omits a stored surface which has never reported a layout', () => {
		db.getTableView('surfaces').set('old1', makeStoredConfig({ layout: undefined }))

		expect(controller.getSurfaceLayouts()).toEqual({})
	})

	test('derives the button sizes of an offline surface from its stored layout', () => {
		db.getTableView('surfaces').set('offline1', makeStoredConfig({ layout: neoLayout }))

		expect(controller.getSurfaceButtonSizes().offline1.bitmapSizes).toEqual([
			{ w: 96, h: 96 },
			{ w: 248, h: 58 },
		])
	})

	test('reports a connected surface as connected, with the layout it reported', () => {
		controller.addSatelliteDevice(satelliteDeviceInfo())

		const layouts = controller.getSurfaceLayouts()
		const ids = Object.keys(layouts)

		expect(ids).toHaveLength(1)
		expect(layouts[ids[0]].isConnected).toBe(true)
		expect(layouts[ids[0]].type).toBe('Stream Deck Neo')
		expect(layouts[ids[0]].layout).toEqual(neoLayout)
	})

	test('reports a connected surface once, not also as a stored one', () => {
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		// The surface has been persisted by being opened, so it is in both places it is gathered from
		expect(db.getTableView('surfaces').get(surfaceId)).toBeTruthy()
		expect(Object.keys(controller.getSurfaceLayouts())).toEqual([surfaceId])
	})

	test('keeps reporting a surface once it disconnects, now as offline', () => {
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		controller.removeDevice(surfaceId)

		const layouts = controller.getSurfaceLayouts()
		expect(layouts[surfaceId].isConnected).toBe(false)
		expect(layouts[surfaceId].layout).toEqual(neoLayout)
	})

	test('stops reporting a surface which is forgotten', () => {
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		controller.removeDevice(surfaceId)
		// What the surfaceForget mutation does once the surface is no longer active
		controller.setDeviceConfig(surfaceId, undefined)

		expect(controller.getSurfaceLayouts()).toEqual({})
	})
})

describe('SurfaceController layout subscriptions', () => {
	let controller: SurfaceController
	let db: TestDatabase

	beforeEach(() => {
		;({ controller, db } = createController())
	})

	async function watchButtonSizes() {
		const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
		return caller.watchSurfaceButtonSizes() as Promise<AsyncIterable<Record<string, ClientSurfaceButtonSizesItem>>>
	}

	test('sends the current button sizes when the subscription starts', async () => {
		controller.addSatelliteDevice(satelliteDeviceInfo())

		const sub = new SubscriptionTester(await watchButtonSizes(), { timeoutMs: 2000 })

		const initial = await sub.next()
		expect(Object.values(initial).map((s) => s.bitmapSizes)).toEqual([
			[
				{ w: 96, h: 96 },
				{ w: 248, h: 58 },
			],
		])

		await sub.cleanup()
	})

	test('pushes an update when a surface is added', async () => {
		const sub = new SubscriptionTester(await watchButtonSizes(), { timeoutMs: 2000 })

		expect(await sub.next()).toEqual({})

		controller.addSatelliteDevice(satelliteDeviceInfo())

		const update = await sub.next()
		expect(Object.values(update).map((s) => s.type)).toEqual(['Stream Deck Neo'])

		await sub.cleanup()
	})

	test('pushes an update when a surface is forgotten', async () => {
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		const sub = new SubscriptionTester(await watchButtonSizes(), { timeoutMs: 2000 })
		expect(Object.keys(await sub.next())).toEqual([surfaceId])

		controller.removeDevice(surfaceId)
		controller.setDeviceConfig(surfaceId, undefined)
		controller.triggerUpdateDevicesList()

		expect(await sub.next()).toEqual({})

		await sub.cleanup()
	})

	test('the layouts subscription carries the full manifest, the button sizes one does not', async () => {
		db.getTableView('surfaces').set('offline1', makeStoredConfig({ layout: neoLayout }))

		const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
		const layoutSub = new SubscriptionTester(
			(await caller.watchSurfaceLayouts()) as AsyncIterable<Record<string, ClientSurfaceLayoutItem>>,
			{ timeoutMs: 2000 }
		)
		const sizesSub = new SubscriptionTester(await watchButtonSizes(), { timeoutMs: 2000 })

		expect((await layoutSub.next()).offline1.layout).toEqual(neoLayout)

		const sizes = (await sizesSub.next()).offline1 as unknown as Record<string, unknown>
		expect(sizes.bitmapSizes).toBeTruthy()
		expect(sizes.layout).toBeUndefined()
		expect(sizes.controls).toBeUndefined()
		expect(sizes.stylePresets).toBeUndefined()

		await layoutSub.cleanup()
		await sizesSub.cleanup()
	})

	test('does not push anything when nothing about the surfaces changed', async () => {
		// Stored surfaces rather than connected ones, so nothing can change underneath the assertions
		db.getTableView('surfaces').set('offline1', makeStoredConfig({ layout: neoLayout }))

		const sub = new SubscriptionTester(await watchButtonSizes(), { timeoutMs: 2000 })
		expect(Object.keys(await sub.next())).toEqual(['offline1'])

		// A surfaces list update which leaves the layouts alone, such as a brightness change elsewhere
		controller.triggerUpdateDevicesList()
		// Long enough that this update cannot be coalesced into the next one by the debounce
		await new Promise((resolve) => setTimeout(resolve, 300))

		db.getTableView('surfaces').set('offline2', makeStoredConfig({ layout: neoLayout }))
		controller.triggerUpdateDevicesList()

		// The very next push is the real change: the no-op update above sent nothing
		expect(Object.keys(await sub.next())).toEqual(['offline1', 'offline2'])

		await sub.cleanup()
	})
})

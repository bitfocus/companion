import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type {
	ClientSurfaceButtonSizesItem,
	ClientSurfaceLayoutItem,
	SurfaceConfig,
	SurfaceSchemaLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import type { IpcWrapper } from '../../lib/Instance/Common/IpcWrapper.js'
import type {
	HostOpenDeviceResult,
	HostToSurfaceModuleEvents,
	SurfaceModuleToHostEvents,
} from '../../lib/Instance/Surface/IpcTypes.js'
import { SurfaceController } from '../../lib/Surface/Controller.js'
import type { SatelliteDeviceInfo } from '../../lib/Surface/IP/Satellite.js'
import { SurfacePluginPanel } from '../../lib/Surface/PluginPanel.js'
import { mangleReferenceSurfaceId } from '../../lib/Surface/ReferenceSurfaceId.js'
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

const neoLayout: SurfaceSchemaLayoutDefinition = {
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
		appearance: undefined,
		modelId: undefined,
		lastSeen: undefined,
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

	const controller = new SurfaceController(db as any, deps, true)

	return { controller, db, deps }
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
			integrationType: 'satellite',
			displayName: 'Stream Deck Neo (offline1)',
			isConnected: false,
			layout: neoLayout,
			appearance: null,
			modelId: null,
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

	describe('satellite appearance', () => {
		const appearance = {
			size: { width: 120, height: 200 },
			bodyColor: '#1c1c1c',
			controls: {
				'0/0': { x: 10, y: 10, width: 96, height: 96 },
				'1/0': { x: 0, y: 120, width: 120, height: 58 },
			},
		}

		test('reports no appearance until the surface describes one', () => {
			const device = controller.addSatelliteDevice(satelliteDeviceInfo())

			expect(controller.getSurfaceLayouts()[device.info.surfaceId].appearance).toBeNull()
		})

		test('reports the appearance a surface described after being added, and keeps it once it disconnects', () => {
			const device = controller.addSatelliteDevice(satelliteDeviceInfo())
			const surfaceId = device.info.surfaceId

			device.updateAppearance(appearance)
			expect(controller.getSurfaceLayouts()[surfaceId].appearance).toEqual(appearance)
			expect(db.getTableView('surfaces').get(surfaceId)?.appearance).toEqual(appearance)

			controller.removeDevice(surfaceId)
			expect(controller.getSurfaceLayouts()[surfaceId].appearance).toEqual(appearance)
		})

		test('replaces the appearance when the surface describes another', () => {
			const device = controller.addSatelliteDevice(satelliteDeviceInfo())
			const surfaceId = device.info.surfaceId

			device.updateAppearance(appearance)
			const recoloured = { ...appearance, bodyColor: '#ff0000' }
			device.updateAppearance(recoloured)

			expect(controller.getSurfaceLayouts()[surfaceId].appearance).toEqual(recoloured)
		})

		test('forgets the appearance when the surface is added again, until it describes one again', () => {
			const device = controller.addSatelliteDevice(satelliteDeviceInfo())
			const surfaceId = device.info.surfaceId
			device.updateAppearance(appearance)
			controller.removeDevice(surfaceId)

			controller.addSatelliteDevice(satelliteDeviceInfo())

			expect(controller.getSurfaceLayouts()[surfaceId].appearance).toBeNull()
		})
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

describe('SurfaceController last seen', () => {
	let controller: SurfaceController
	let db: TestDatabase

	beforeEach(() => {
		vi.useFakeTimers()
		;({ controller, db } = createController())
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	function findSurface(surfaceId: string) {
		return controller
			.getDevicesList()
			.flatMap((group) => group.surfaces)
			.find((surface) => surface.id === surfaceId)
	}

	test('reports null for a stored surface which predates tracking it', () => {
		db.getTableView('surfaces').set('old1', makeStoredConfig({}))

		expect(findSurface('old1')?.lastSeen).toBeNull()
	})

	test('records when a surface connected', () => {
		vi.setSystemTime(1000)
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())

		expect(findSurface(device.info.surfaceId)?.lastSeen).toBe(1000)
	})

	test('records when a surface disconnected', () => {
		vi.setSystemTime(1000)
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		vi.setSystemTime(5000)
		controller.removeDevice(surfaceId)

		expect(findSurface(surfaceId)).toMatchObject({ isConnected: false, lastSeen: 5000 })
		expect(db.getTableView('surfaces').get(surfaceId)?.lastSeen).toBe(5000)
	})

	test('periodically re-stamps the connected surfaces', () => {
		vi.setSystemTime(1000)
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())
		const surfaceId = device.info.surfaceId

		vi.advanceTimersByTime(2 * 60 * 60 * 1000)

		expect(db.getTableView('surfaces').get(surfaceId)?.lastSeen).toBe(1000 + 2 * 60 * 60 * 1000)
	})

	test('records when the surfaces were shut down', () => {
		vi.setSystemTime(1000)
		const device = controller.addSatelliteDevice(satelliteDeviceInfo())

		vi.setSystemTime(5000)
		controller.quit()

		expect(db.getTableView('surfaces').get(device.info.surfaceId)?.lastSeen).toBe(5000)
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

function addPluginPanel(controller: SurfaceController, surfaceId: string, connectionId: string) {
	const ipc = mockDeep<IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>>()
	ipc.sendWithCb.mockResolvedValue(undefined)
	const info: HostOpenDeviceResult = {
		surfaceId,
		description: 'Test control event surface',
		supportsBrightness: false,
		controlEvents: { connectionId },
		surfaceLayout: neoLayout,
		surfaceAppearance: null,
		modelId: null,
		transferVariables: null,
		location: null,
		isRemote: false,
		configFields: null,
	}
	const panel = new SurfacePluginPanel(ipc, 'test-instance', info, vi.fn())
	vi.spyOn(panel, 'draw').mockImplementation(() => {})
	controller.addPluginPanel('test-module', panel)
	return { ipc, panel }
}

function controlEventCalls(ipc: ReturnType<typeof addPluginPanel>['ipc']) {
	return ipc.sendWithCb.mock.calls.filter(([event]) => event === 'controlEvent').map(([, msg]) => msg)
}

describe('SurfaceController control event routing', () => {
	let controller: SurfaceController

	beforeEach(() => {
		const created = createController()
		controller = created.controller
		created.deps.pageStore.getPageNumber.mockReturnValue(1)
	})

	test('routes an explicit cue to the connected panel and strips a reference surface id', () => {
		const { ipc } = addPluginPanel(controller, 'test:deck', 'open-1')
		const location = { pageNumber: 1, row: 1, column: 0 }

		controller.sendDeviceControlEvent('test:deck', location, 'press')
		controller.sendDeviceControlEvent(mangleReferenceSurfaceId('test:deck', 'bank:1-0-0'), location, 'hold')
		expect(controlEventCalls(ipc)).toEqual([
			{ surfaceId: 'test:deck', connectionId: 'open-1', controlId: '1/0', event: 'press' },
			{ surfaceId: 'test:deck', connectionId: 'open-1', controlId: '1/0', event: 'hold' },
		])
	})

	test('does not throw or broadcast for an unknown or group id', async () => {
		const first = addPluginPanel(controller, 'test:first', 'open-1')
		const second = addPluginPanel(controller, 'test:second', 'open-2')
		const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
		const groupId = await caller.groupAdd({ baseId: 'cues', name: 'Cues' })
		await caller.surfaceSetGroup({ surfaceId: 'test:first', groupId })
		await caller.surfaceSetGroup({ surfaceId: 'test:second', groupId })

		const location = { pageNumber: 1, row: 0, column: 0 }
		expect(() => controller.sendDeviceControlEvent('missing', location, 'press')).not.toThrow()
		expect(() => controller.sendDeviceControlEvent(groupId, location, 'press')).not.toThrow()
		expect(controlEventCalls(first.ipc)).toHaveLength(0)
		expect(controlEventCalls(second.ipc)).toHaveLength(0)
	})

	test('does not expose the connection id in the client device list', () => {
		addPluginPanel(controller, 'test:deck', 'open-1')

		const surface = controller
			.getDevicesList()
			.flatMap((group) => group.surfaces)
			.find((item) => item.id === 'test:deck')
		expect(surface).toBeTruthy()
		expect(JSON.stringify(surface)).not.toContain('open-1')
	})
})

describe('Satellite control events', () => {
	function satellitePanel(overrides: Partial<SatelliteDeviceInfo>) {
		const { controller } = createController()
		const info = satelliteDeviceInfo(overrides)
		const panel = controller.addSatelliteDevice(info)
		const sendMessage = info.socket.sendMessage as ReturnType<typeof vi.fn>
		const events = () => sendMessage.mock.calls.filter(([name]) => name === 'CONTROL-EVENT')
		return { panel, events }
	}

	test('sends CONTROL-EVENT with the control id to a client that asked for it', () => {
		const { panel, events } = satellitePanel({ supportsControlEvents: true })
		expect(panel.info.supportsControlEvents).toBe(true)

		panel.controlEvent(0, 1, 'hold')
		expect(events()).toEqual([['CONTROL-EVENT', null, 'dev1', { CONTROLID: '1/0', EVENT: 'hold' }]])

		panel.controlEvent(4, 4, 'press')
		expect(events()).toHaveLength(1)
	})

	test('uses the key index for a client in grid mode', () => {
		const { panel, events } = satellitePanel({
			supportsControlEvents: true,
			surfaceManifestFromClient: false,
			gridSize: { columns: 2, rows: 2 },
			surfaceManifest: {
				stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
				controls: { '0/0': { row: 0, column: 0 }, '1/1': { row: 1, column: 1 } },
			},
		})

		panel.controlEvent(1, 1, 'press')
		expect(events()).toEqual([['CONTROL-EVENT', null, 'dev1', { KEY: 3, EVENT: 'press' }]])
	})

	test('sends nothing to a client that did not ask, or after the device is closed', () => {
		const legacy = satellitePanel({})
		expect(legacy.panel.info.supportsControlEvents).toBe(false)
		legacy.panel.controlEvent(0, 0, 'press')
		expect(legacy.events()).toHaveLength(0)

		const closed = satellitePanel({ supportsControlEvents: true })
		closed.panel.quit()
		closed.panel.controlEvent(0, 0, 'press')
		expect(closed.events()).toHaveLength(0)
	})
})

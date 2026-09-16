import { initTRPC } from '@trpc/server'
import { beforeEach, describe, expect, test } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { SurfaceModelsUpdate, SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import type { IpcSurfaceModel } from '../../lib/Instance/Surface/IpcTypes.js'
import { SurfaceController } from '../../lib/Surface/Controller.js'
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

const xlLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 96, h: 96 } } },
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1 },
	},
}

// The controller does not validate models, so an appearance is not needed to exercise it
function ipcModel(id: string, name: string): IpcSurfaceModel {
	return { id, name, layout: xlLayout, appearance: undefined }
}

function createController() {
	const db = new TestDatabase()
	const deps = mockDeep<SurfaceHandlerDependencies>({ fallbackMockImplementation: () => undefined })
	deps.userconfig.getKey.mockImplementation((key: string) => {
		if (key === 'gridSize') return { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
		return undefined
	})

	return { controller: new SurfaceController(db as any, deps), db }
}

describe('surface models', () => {
	let controller: SurfaceController

	beforeEach(() => {
		controller = createController().controller
	})

	test('has nothing to offer before a plugin has declared anything', () => {
		expect(controller.getSurfaceModels()).toEqual([])
	})

	test('qualifies a model id by the module which declared it', () => {
		controller.setSurfaceModelsForInstance('instance1', 'elgato-streamdeck', [ipcModel('xl', 'Stream Deck XL')])

		expect(controller.getSurfaceModels()).toEqual([
			{
				id: 'elgato-streamdeck:xl',
				moduleId: 'elgato-streamdeck',
				name: 'Stream Deck XL',
				layout: xlLayout,
				appearance: undefined,
			},
		])
	})

	test('keeps two models which share a name apart, rather than deduplicating them', () => {
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [ipcModel('xl', 'Stream Deck XL')])
		controller.setSurfaceModelsForInstance('instance2', 'moduleB', [ipcModel('xl', 'Stream Deck XL')])

		expect(controller.getSurfaceModels().map((model) => model.id)).toEqual(['moduleA:xl', 'moduleB:xl'])
	})

	test('suffixes the module onto a name shared across modules, but leaves unique names clean', () => {
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [
			ipcModel('xl', 'Stream Deck XL'),
			ipcModel('plus', 'Stream Deck +'),
		])
		controller.setSurfaceModelsForInstance('instance2', 'moduleB', [ipcModel('xl', 'Stream Deck XL')])

		expect(controller.getSurfaceModels().map((model) => ({ id: model.id, name: model.name }))).toEqual([
			{ id: 'moduleA:plus', name: 'Stream Deck +' },
			{ id: 'moduleA:xl', name: 'Stream Deck XL (moduleA)' },
			{ id: 'moduleB:xl', name: 'Stream Deck XL (moduleB)' },
		])
	})

	test('sorts by name, so the list does not depend on which plugin started first', () => {
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [
			ipcModel('plus', 'Stream Deck +'),
			ipcModel('xl', 'Stream Deck XL'),
		])
		controller.setSurfaceModelsForInstance('instance2', 'moduleB', [ipcModel('neo', 'Loupedeck Live')])

		expect(controller.getSurfaceModels().map((model) => model.name)).toEqual([
			'Loupedeck Live',
			'Stream Deck +',
			'Stream Deck XL',
		])
	})

	test('replaces what an instance declared before, rather than accumulating', () => {
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [
			ipcModel('xl', 'Stream Deck XL'),
			ipcModel('plus', 'Stream Deck +'),
		])
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [ipcModel('xl', 'Stream Deck XL')])

		expect(controller.getSurfaceModels().map((model) => model.id)).toEqual(['moduleA:xl'])
	})

	test('forgets the models of an instance when it goes away', () => {
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [ipcModel('xl', 'Stream Deck XL')])
		controller.setSurfaceModelsForInstance('instance2', 'moduleB', [ipcModel('neo', 'Stream Deck Neo')])

		controller.cleanupForInstance('instance1')

		expect(controller.getSurfaceModels().map((model) => model.id)).toEqual(['moduleB:neo'])
	})

	test('carries the appearance through to what is offered', () => {
		const appearance = {
			size: { width: 10, height: 10 },
			bodyColor: '#000000',
			controls: { '0/0': { x: 0, y: 0, width: 1, height: 1 } },
		}
		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [
			{ id: 'xl', name: 'Stream Deck XL', layout: xlLayout, appearance },
		])

		expect(controller.getSurfaceModels().map((model) => model.appearance)).toEqual([appearance])
	})

	test('pushes the models out to a subscriber as add/remove ops rather than the whole list', async () => {
		const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
		const sub = new SubscriptionTester((await caller.watchSurfaceModels()) as AsyncIterable<SurfaceModelsUpdate[]>, {
			timeoutMs: 2000,
		})

		// Nothing has been declared yet, so the first value is an empty init rather than nothing at all
		expect(await sub.next()).toEqual([{ type: 'init', models: {} }])

		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [ipcModel('xl', 'Stream Deck XL')])
		expect(await sub.next()).toEqual([
			{
				type: 'replace',
				itemId: 'moduleA:xl',
				info: {
					id: 'moduleA:xl',
					moduleId: 'moduleA',
					name: 'Stream Deck XL',
					layout: xlLayout,
					appearance: undefined,
				},
			},
		])

		controller.cleanupForInstance('instance1')
		expect(await sub.next()).toEqual([{ type: 'remove', itemId: 'moduleA:xl' }])

		await sub.cleanup()
	})

	test('only sends the models which changed, not every plugin, when one instance updates', async () => {
		const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)
		const sub = new SubscriptionTester((await caller.watchSurfaceModels()) as AsyncIterable<SurfaceModelsUpdate[]>, {
			timeoutMs: 2000,
		})

		expect(await sub.next()).toEqual([{ type: 'init', models: {} }])

		controller.setSurfaceModelsForInstance('instance1', 'moduleA', [ipcModel('xl', 'Stream Deck XL')])
		expect(await sub.next()).toEqual([
			{
				type: 'replace',
				itemId: 'moduleA:xl',
				info: {
					id: 'moduleA:xl',
					moduleId: 'moduleA',
					name: 'Stream Deck XL',
					layout: xlLayout,
					appearance: undefined,
				},
			},
		])

		controller.setSurfaceModelsForInstance('instance2', 'moduleB', [ipcModel('neo', 'Stream Deck Neo')])
		// moduleA was untouched, so only moduleB's model is sent
		expect(await sub.next()).toEqual([
			{
				type: 'replace',
				itemId: 'moduleB:neo',
				info: {
					id: 'moduleB:neo',
					moduleId: 'moduleB',
					name: 'Stream Deck Neo',
					layout: xlLayout,
					appearance: undefined,
				},
			},
		])

		await sub.cleanup()
	})
})

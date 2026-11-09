import { describe, expect, test, vi } from 'vitest'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '../../../shared-lib/lib/Model/Instance.js'
import { InstanceConfigStore } from '../../lib/Instance/ConfigStore.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

function makeConnection(sortOrder: number, collectionId?: string): InstanceConfig {
	return {
		moduleInstanceType: ModuleInstanceType.Connection,
		moduleId: 'test-module',
		moduleVersionId: null,
		updatePolicy: InstanceVersionUpdatePolicy.Stable,
		label: 'Test',
		config: {},
		secrets: {},
		isFirstInit: false,
		lastUpgradeIndex: 0,
		enabled: true,
		sortOrder,
		collectionId,
	}
}

function createStore() {
	const db = new FakeDataDatabase()
	const table = db.getTableView('instances')
	table.data = {
		A: makeConnection(0),
		B: makeConnection(1),
		C: makeConnection(0, 'group-a'),
	}
	const afterSave = vi.fn()
	const store = new InstanceConfigStore(db.asDataDatabase(), afterSave)

	return { store, table, afterSave }
}

describe('InstanceConfigStore.moveInstances', () => {
	test('evaluates same-position moves sequentially and commits once', () => {
		const { store, table, afterSave } = createStore()

		const result = store.moveInstances(ModuleInstanceType.Connection, [
			{ connectionId: 'C', collectionId: null, position: 0 },
			{ connectionId: 'B', collectionId: null, position: 0 },
		])

		expect(result).toEqual({ ok: true })
		expect(['B', 'C', 'A'].map((id) => table.data[id].sortOrder)).toEqual([0, 1, 2])
		expect(['B', 'C', 'A'].map((id) => table.data[id].collectionId)).toEqual([undefined, undefined, undefined])
		expect(afterSave).toHaveBeenCalledTimes(1)
		expect(new Set(afterSave.mock.calls[0][0])).toEqual(new Set(['A', 'B', 'C']))
		expect(afterSave.mock.calls[0][1]).toBe(true)
	})

	test('does not mutate or persist when a later operation is invalid', () => {
		const { store, table, afterSave } = createStore()
		const initialData = structuredClone(table.data)

		const result = store.moveInstances(ModuleInstanceType.Connection, [
			{ connectionId: 'C', collectionId: null, position: 0 },
			{ connectionId: 'B', collectionId: null, position: 99 },
		])

		expect(result).toEqual({
			ok: false,
			operationIndex: 1,
			reason: 'invalid_position',
			message: 'Position 99 is outside destination collection bounds (0 to 2)',
		})
		expect(table.data).toEqual(initialData)
		expect(afterSave).not.toHaveBeenCalled()
	})
})

describe('InstanceConfigStore loading and saving', () => {
	function createStoreWith(rows: Record<string, unknown>) {
		const db = new FakeDataDatabase()
		const table = db.getTableView('instances')
		table.data = structuredClone(rows)
		const afterSave = vi.fn()
		return { store: new InstanceConfigStore(db.asDataDatabase(), afterSave), table, afterSave }
	}

	test('fills in defaults for an old instance', () => {
		const { store } = createStoreWith({ old: { moduleId: 'test-module', label: 'old', config: { host: 'x' } } })

		expect(store.getConfigOfTypeForId('old', null)).toEqual({
			moduleInstanceType: ModuleInstanceType.Connection,
			moduleId: 'test-module',
			moduleVersionId: null,
			label: 'old',
			config: { host: 'x' },
			secrets: {},
			isFirstInit: false,
			lastUpgradeIndex: -1,
			enabled: true,
			sortOrder: 0,
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
		})
	})

	test('a config or secrets that is not a JSON object is reset, keeping the instance', () => {
		const { store, table } = createStoreWith({
			A: { ...makeConnection(0), config: 'host=x', secrets: [1, 2] },
			B: { ...makeConnection(1), config: { host: 'y' } },
		})

		expect(store.getConfigOfTypeForId('A', null)).toEqual({ ...makeConnection(0), config: {}, secrets: {} })
		expect(store.getConfigOfTypeForId('B', null)).toMatchObject({ config: { host: 'y' } })
		// The repair is stored
		expect(table.data['A']).toMatchObject({ config: {}, secrets: {} })
	})

	test('an instance missing its module is not loaded', () => {
		const { store } = createStoreWith({ good: makeConnection(0), bad: { label: 'no module', config: {} } })

		expect(store.getAllInstanceIdsOfType(null)).toEqual(['good'])
	})

	test('an invalid change to an instance is discarded', () => {
		const { store, table } = createStoreWith({ A: makeConnection(0) })

		const config = store.getConfigOfTypeForId('A', null)!
		config.label = 'Renamed'
		config.sortOrder = 'first' as any

		store.commitChanges(['A'], false)

		expect(store.getConfigOfTypeForId('A', null)).toEqual(makeConnection(0))
		expect(table.data['A']).toEqual(makeConnection(0))
	})

	test('an invalid instance is not saved, but the others still are', () => {
		const { store, table, afterSave } = createStoreWith({})
		const [goodId] = store.addConnection('test-module', 'good', undefined, {
			versionId: null,
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
			disabled: false,
		})
		const [badId] = store.addConnection('test-module', 'bad', undefined, {
			versionId: null,
			updatePolicy: 'sometimes' as any,
			disabled: false,
		})

		store.commitChanges([badId, goodId], false)

		expect(table.data[goodId]).toMatchObject({ label: 'good' })
		expect(table.data[badId]).toBeUndefined()
		// And it is forgotten, as it was never saved
		expect(store.getConfigOfTypeForId(badId, null)).toBeUndefined()
		expect(store.getConfigOfTypeForId(goodId, null)).toMatchObject({ label: 'good' })
		expect(afterSave).toHaveBeenCalledWith([badId, goodId], false)
	})
})

describe('InstanceConfigStore.makeLabelValid', () => {
	test('keeps a valid label', () => {
		const { store } = createStore()
		expect(store.makeLabelValid(ModuleInstanceType.Connection, 'my_label', 'A')).toBe('my_label')
	})

	test('sanitises invalid characters', () => {
		const { store } = createStore()
		expect(store.makeLabelValid(ModuleInstanceType.Connection, 'my label', 'A')).toBe('my_label')
	})

	test('adds a suffix to a reserved word', () => {
		const { store } = createStore()
		expect(store.makeLabelValid(ModuleInstanceType.Connection, 'options', 'A')).toBe('options_1')
		expect(store.makeLabelValid(ModuleInstanceType.Connection, 'page', 'A')).toBe('page_1')
	})

	test('makes the suffixed label unique', () => {
		const db = new FakeDataDatabase()
		db.getTableView('instances').data = {
			A: { ...makeConnection(0), label: 'options' },
			B: { ...makeConnection(1), label: 'options_1' },
		}
		const store = new InstanceConfigStore(db.asDataDatabase(), vi.fn())

		expect(store.makeLabelValid(ModuleInstanceType.Connection, 'options', 'A')).toBe('options_1_2')
	})
})

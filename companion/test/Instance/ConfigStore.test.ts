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
		expect(table.data.B).toMatchObject({ collectionId: undefined, sortOrder: 0 })
		expect(table.data.C).toMatchObject({ collectionId: undefined, sortOrder: 1 })
		expect(table.data.A).toMatchObject({ collectionId: undefined, sortOrder: 2 })
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

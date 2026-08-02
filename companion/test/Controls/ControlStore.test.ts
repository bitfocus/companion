import { describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { ControlStore } from '../../lib/Controls/ControlStore.js'
import type { DataDatabase } from '../../lib/Data/Database.js'
import type { VariablesValues } from '../../lib/Variables/Values.js'

function createStore() {
	const store = new ControlStore(mockDeep<DataDatabase>(), mockDeep<VariablesValues>())
	// Rotation short-circuits before looking up a control; spy so we can assert whether it got that far.
	const getControl = vi.spyOn(store, 'getControl').mockReturnValue(undefined)
	return { store, getControl }
}

describe('rotateControl', () => {
	test.each([0, -0, NaN, Infinity, -Infinity])('does not dispatch a %s delta', (delta) => {
		const { store, getControl } = createStore()

		expect(store.rotateControl('control:test', delta, undefined)).toBe(false)
		expect(getControl).not.toHaveBeenCalled()
	})

	test('attempts to dispatch a non-zero finite delta', () => {
		const { store, getControl } = createStore()

		store.rotateControl('control:test', -2, undefined)

		expect(getControl).toHaveBeenCalledWith('control:test')
	})
})

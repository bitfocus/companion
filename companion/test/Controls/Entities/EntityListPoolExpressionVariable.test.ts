import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { createExpressionVariablePool, feedbackModel, feedbackValues } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (local-variable/special-expression processing) that would
// otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

/** A minimal ExpressionVariableModel carrying just the fields the pool reads in loadStorage. */
function expressionVariableStorage(overrides: Partial<ExpressionVariableModel> = {}): ExpressionVariableModel {
	return {
		entity: null,
		localVariables: [],
		...overrides,
	} as ExpressionVariableModel
}

describe('EntityListPoolExpressionVariable', () => {
	describe('loadStorage', () => {
		test('loads the single root entity and exposes it via getRootEntity', () => {
			const { pool } = createExpressionVariablePool()
			const entity = feedbackModel()

			pool.loadStorage(expressionVariableStorage({ entity }), true, false)

			expect(pool.getRootEntity()?.id).toBe(entity.id)
		})

		test('getRootEntity is undefined when there is no root entity', () => {
			const { pool } = createExpressionVariablePool()

			pool.loadStorage(expressionVariableStorage({ entity: null }), true, false)

			expect(pool.getRootEntity()).toBeUndefined()
		})

		test('loads local variables into their own list', () => {
			const { pool } = createExpressionVariablePool()

			pool.loadStorage(expressionVariableStorage({ localVariables: [feedbackModel(), feedbackModel()] }), true, false)

			expect(pool.getLocalVariableEntities()).toHaveLength(2)
		})
	})

	describe('root entity list is limited to a single child', () => {
		test('adding a second root entity is rejected', () => {
			const { pool } = createExpressionVariablePool()

			expect(pool.entityAdd('feedbacks', null, feedbackModel())).toBe(true)
			expect(pool.getRootEntity()).toBeDefined()

			// The root list is created with maximumChildren: 1, so a second add cannot be accepted
			expect(() => pool.entityAdd('feedbacks', null, feedbackModel())).toThrow()
		})
	})

	describe('updateFeedbackValues', () => {
		test('reports a no-save redraw when the root value changes', () => {
			const { pool, reportChange } = createExpressionVariablePool()
			const entity = feedbackModel()
			pool.loadStorage(expressionVariableStorage({ entity }), true, false)
			reportChange.mockClear()

			pool.updateFeedbackValues('conn01', feedbackValues({ [entity.id]: 42 }))

			expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true })
		})

		test('is a no-op for values that match no entity', () => {
			const { pool, reportChange } = createExpressionVariablePool()
			pool.loadStorage(expressionVariableStorage({ entity: feedbackModel() }), true, false)
			reportChange.mockClear()

			pool.updateFeedbackValues('conn01', feedbackValues({ 'unrelated-id': 1 }))

			expect(reportChange).not.toHaveBeenCalled()
		})
	})

	describe('updateIsInvertedValues', () => {
		test('reports a no-save redraw when the root entity inversion changes', () => {
			const { pool, reportChange } = createExpressionVariablePool()
			const entity = feedbackModel()
			pool.loadStorage(expressionVariableStorage({ entity }), true, false)
			reportChange.mockClear()

			pool.updateIsInvertedValues(new Map([[entity.id, { entityId: entity.id, controlId: '', value: true }]]))

			expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true })
		})

		test('is a no-op for inversion values that match no entity', () => {
			const { pool, reportChange } = createExpressionVariablePool()
			pool.loadStorage(expressionVariableStorage({ entity: feedbackModel() }), true, false)
			reportChange.mockClear()

			pool.updateIsInvertedValues(new Map([['unrelated-id', { entityId: 'unrelated-id', controlId: '', value: true }]]))

			expect(reportChange).not.toHaveBeenCalled()
		})
	})

	test('updateStoreResultValues is a no-op (lists hold feedbacks, not actions)', () => {
		const { pool, reportChange } = createExpressionVariablePool()
		pool.loadStorage(expressionVariableStorage({ entity: feedbackModel() }), true, false)
		reportChange.mockClear()

		expect(() => pool.updateStoreResultValues(new Map())).not.toThrow()
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('getFeedbackStyleOverrides returns an empty map', () => {
		const { pool } = createExpressionVariablePool()

		expect(pool.getFeedbackStyleOverrides(undefined).size).toBe(0)
	})
})

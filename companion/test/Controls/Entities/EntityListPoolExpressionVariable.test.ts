import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { NewFeedbackValue } from '../../../lib/Controls/Entities/Types.js'
import { createExpressionVariablePool, feedbackModel } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (local-variable/special-expression processing) that would
// otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

/** Build the feedback-value map shape the pool consumes for a set of entityId -> value pairs. */
function feedbackValues(values: Record<string, any>): Map<string, NewFeedbackValue> {
	const map = new Map<string, NewFeedbackValue>()
	for (const [entityId, value] of Object.entries(values)) {
		map.set(entityId, { entityId, controlId: '', value })
	}
	return map
}

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

	test('updateStoreResultValues is a no-op (lists hold feedbacks, not actions)', () => {
		const { pool, reportChange } = createExpressionVariablePool()
		pool.loadStorage(expressionVariableStorage({ entity: feedbackModel() }), true, false)
		reportChange.mockClear()

		expect(() => pool.updateStoreResultValues(new Map())).not.toThrow()
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('getFeedbackStyleOverrides returns an empty map', () => {
		const { pool } = createExpressionVariablePool()

		expect(pool.getFeedbackStyleOverrides().size).toBe(0)
	})
})

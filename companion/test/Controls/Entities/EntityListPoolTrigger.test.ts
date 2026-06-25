import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { actionModel, createTriggerPool, feedbackModel, feedbackValues } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (local-variable/special-expression processing) that would
// otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

/** A minimal TriggerModel carrying just the entity lists the pool reads in loadStorage. */
function triggerStorage(overrides: Partial<TriggerModel> = {}): TriggerModel {
	return {
		condition: [],
		actions: [],
		localVariables: [],
		...overrides,
	} as TriggerModel
}

describe('ControlEntityListPoolTrigger', () => {
	describe('loadStorage', () => {
		test('routes condition/actions/localVariables into their respective lists', () => {
			const { pool } = createTriggerPool()

			pool.loadStorage(
				triggerStorage({
					condition: [feedbackModel(), feedbackModel()],
					actions: [actionModel()],
					localVariables: [feedbackModel(), feedbackModel(), feedbackModel()],
				}),
				true,
				false
			)

			expect(pool.getFeedbackEntities()).toHaveLength(2)
			expect(pool.getActionEntities()).toHaveLength(1)
			expect(pool.getLocalVariableEntities()).toHaveLength(3)
		})

		test('tolerates missing list properties', () => {
			const { pool } = createTriggerPool()

			expect(() => pool.loadStorage({} as TriggerModel, true, false)).not.toThrow()

			expect(pool.getFeedbackEntities()).toHaveLength(0)
			expect(pool.getActionEntities()).toHaveLength(0)
			expect(pool.getLocalVariableEntities()).toHaveLength(0)
		})
	})

	describe('entity list routing', () => {
		test('entityAdd resolves the feedbacks, trigger_actions and local-variables lists', () => {
			const { pool } = createTriggerPool()

			expect(pool.entityAdd('feedbacks', null, feedbackModel())).toBe(true)
			expect(pool.entityAdd('trigger_actions', null, actionModel())).toBe(true)
			expect(pool.entityAdd('local-variables', null, feedbackModel())).toBe(true)

			expect(pool.getFeedbackEntities()).toHaveLength(1)
			expect(pool.getActionEntities()).toHaveLength(1)
			expect(pool.getLocalVariableEntities()).toHaveLength(1)
		})

		test('entityAdd returns false for an unknown list', () => {
			const { pool } = createTriggerPool()

			expect(pool.entityAdd('some-unknown-list' as any, null, feedbackModel())).toBe(false)
		})
	})

	describe('checkConditionValue', () => {
		test('an empty condition is treated as true', () => {
			const { pool } = createTriggerPool()

			expect(pool.checkConditionValue()).toBe(true)
		})

		test('reflects the boolean value of the condition feedbacks', () => {
			const { pool } = createTriggerPool()
			const feedback = feedbackModel()
			pool.entityAdd('feedbacks', null, feedback)

			pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: true }))
			expect(pool.checkConditionValue()).toBe(true)

			pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: false }))
			expect(pool.checkConditionValue()).toBe(false)
		})
	})

	describe('updateFeedbackValues', () => {
		test('reports a no-save redraw when a condition value changes', () => {
			const { pool, reportChange } = createTriggerPool()
			const feedback = feedbackModel()
			pool.entityAdd('feedbacks', null, feedback)
			reportChange.mockClear()

			pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: true }))

			expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true })
		})

		test('is a no-op for values that match no entity', () => {
			const { pool, reportChange } = createTriggerPool()
			pool.entityAdd('feedbacks', null, feedbackModel())
			reportChange.mockClear()

			pool.updateFeedbackValues('conn01', feedbackValues({ 'unrelated-id': true }))

			expect(reportChange).not.toHaveBeenCalled()
		})
	})

	describe('updateIsInvertedValues', () => {
		test('reports a no-save redraw when a condition feedback inversion changes', () => {
			const { pool, reportChange } = createTriggerPool()
			const feedback = feedbackModel()
			pool.entityAdd('feedbacks', null, feedback)
			reportChange.mockClear()

			pool.updateIsInvertedValues(new Map([[feedback.id, { entityId: feedback.id, controlId: '', value: true }]]))

			expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true })
		})

		test('is a no-op for inversion values that match no condition feedback', () => {
			const { pool, reportChange } = createTriggerPool()
			pool.entityAdd('feedbacks', null, feedbackModel())
			reportChange.mockClear()

			pool.updateIsInvertedValues(new Map([['unrelated-id', { entityId: 'unrelated-id', controlId: '', value: true }]]))

			expect(reportChange).not.toHaveBeenCalled()
		})
	})

	describe('updateStoreResultValues', () => {
		test('applies to actions without reporting a change', () => {
			const { pool, reportChange } = createTriggerPool()
			const action = actionModel()
			pool.entityAdd('trigger_actions', null, action)
			reportChange.mockClear()

			expect(() =>
				pool.updateStoreResultValues(new Map([[action.id, { entityId: action.id, controlId: '', value: undefined }]]))
			).not.toThrow()
			expect(reportChange).not.toHaveBeenCalled()
		})
	})

	test('getFeedbackStyleOverrides returns an empty map', () => {
		const { pool } = createTriggerPool()

		expect(pool.getFeedbackStyleOverrides().size).toBe(0)
	})
})

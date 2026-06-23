import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { SomeReplaceableEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityListChangeProps } from '../../../lib/Controls/Entities/EntityListPoolBase.js'
import { actionModel, createPool, downSet, feedbackModel } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (e.g. for local-variable/special-expression processing) that
// would otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('EntityListPool - entityAdd', () => {
	test('adds an action to an action set and reports a redraw', () => {
		const { pool, reportChange } = createPool()

		const ok = pool.entityAdd(downSet(), null, actionModel())

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(1)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true, invalidateAllElements: false })
	})

	test('adding a feedback invalidates all elements', () => {
		const { pool, reportChange } = createPool()

		const ok = pool.entityAdd('feedbacks', null, feedbackModel())

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true, invalidateAllElements: true })
	})

	test('adding no entities is a no-op', () => {
		const { pool, reportChange } = createPool()

		expect(pool.entityAdd(downSet(), null)).toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('returns false for an unknown list', () => {
		const { pool, reportChange } = createPool()

		expect(pool.entityAdd({ stepId: 'missing', setId: 'down' }, null, actionModel())).toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('throws when the named parent does not exist', () => {
		const { pool } = createPool()

		expect(() => pool.entityAdd(downSet(), { parentId: 'nope', childGroup: 'default' }, actionModel())).toThrow()
	})
})

describe('EntityListPool - entityRemove', () => {
	test('removes an existing entity', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entityRemove(downSet(), action.id)

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(0)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true })
	})

	test('returns false for an unknown entity', () => {
		const { pool, reportChange } = createPool()
		reportChange.mockClear()

		expect(pool.entityRemove(downSet(), 'nope')).toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('returns false for an unknown list', () => {
		const { pool } = createPool()

		expect(pool.entityRemove({ stepId: 'missing', setId: 'down' }, 'x')).toBe(false)
	})
})

describe('EntityListPool - entityDuplicate', () => {
	test('duplicates an existing entity', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)

		const ok = pool.entityDuplicate(downSet(), action.id)

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(2)
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entityDuplicate(downSet(), 'nope')).toBe(false)
	})
})

describe('EntityListPool - entityEnabled', () => {
	test('toggles the enabled flag and redraws', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entityEnabled(downSet(), action.id, false)

		expect(ok).toBe(true)
		expect(pool.findEntityById(action.id)?.disabled).toBe(true)
		expect(reportChange).toHaveBeenCalledWith(
			expect.objectContaining({ redraw: true } satisfies Partial<ControlEntityListChangeProps>)
		)
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entityEnabled(downSet(), 'nope', false)).toBe(false)
	})
})

describe('EntityListPool - entityHeadline', () => {
	test('sets the headline without a redraw', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entityHeadline(downSet(), action.id, 'My headline')

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entityHeadline(downSet(), 'nope', 'x')).toBe(false)
	})
})

describe('EntityListPool - entitySetOption', () => {
	test('updates an option without a redraw', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entitySetOption(downSet(), action.id, 'foo', { isExpression: false, value: 'bar' })

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetOption(downSet(), 'nope', 'foo', { isExpression: false, value: 1 })).toBe(false)
	})
})

describe('EntityListPool - entitySetConnection', () => {
	test('changes the connection and redraws', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel({ connectionId: 'conn-old' })
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entitySetConnection(downSet(), action.id, 'conn-new')

		expect(ok).toBe(true)
		expect(pool.findEntityById(action.id)?.connectionId).toBe('conn-new')
		expect(reportChange).toHaveBeenCalledWith({ redraw: true })
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetConnection(downSet(), 'nope', 'conn')).toBe(false)
	})
})

describe('EntityListPool - entitySetInverted', () => {
	test('sets the inverted flag on a feedback', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		const ok = pool.entitySetInverted('feedbacks', feedback.id, { isExpression: false, value: true })

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith(expect.objectContaining({ redraw: true }))
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetInverted('feedbacks', 'nope', { isExpression: false, value: true })).toBe(false)
	})
})

describe('EntityListPool - entitySetVariableName', () => {
	test('rejects an invalid variable name', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		expect(pool.entitySetVariableName('feedbacks', feedback.id, 'not a valid name!')).toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('accepts a valid variable name', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		const ok = pool.entitySetVariableName('feedbacks', feedback.id, 'my_var')

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetVariableName('feedbacks', 'nope', 'my_var')).toBe(false)
	})
})

describe('EntityListPool - entityMoveTo', () => {
	test('reorders within the same set', () => {
		const { pool, reportChange } = createPool()
		const a = actionModel()
		const b = actionModel()
		pool.entityAdd(downSet(), null, a)
		pool.entityAdd(downSet(), null, b)
		reportChange.mockClear()

		const ok = pool.entityMoveTo(downSet(), b.id, null, downSet(), 0)

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet()).map((e) => e.id)).toEqual([b.id, a.id])
	})

	test('moves between sets', () => {
		const { pool } = createPool()
		const a = actionModel()
		pool.entityAdd(downSet(), null, a)

		const ok = pool.entityMoveTo(downSet(), a.id, null, { stepId: '0', setId: 'up' }, 0)

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(0)
		expect(pool.getAllEntitiesInList({ stepId: '0', setId: 'up' })).toHaveLength(1)
	})

	test('returns false when the entity does not exist', () => {
		const { pool } = createPool()

		expect(pool.entityMoveTo(downSet(), 'nope', null, downSet(), 0)).toBe(false)
	})
})

describe('EntityListPool - entityReplace', () => {
	test('replaces props on an existing entity of the same type', () => {
		const { pool } = createPool()
		const action = actionModel({ definitionId: 'def-old' })
		pool.entityAdd(downSet(), null, action)

		const replacement: SomeReplaceableEntityModel = {
			id: action.id,
			type: EntityModelType.Action,
			definitionId: 'def-new',
			options: { x: { isExpression: false, value: 1 } },
			upgradeIndex: undefined,
		}
		const result = pool.entityReplace(replacement)

		expect(result?.id).toBe(action.id)
		expect(pool.findEntityById(action.id)?.definitionId).toBe('def-new')
	})

	test('returns undefined when the types do not match', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)

		const result = pool.entityReplace({
			id: action.id,
			type: EntityModelType.Feedback,
			definitionId: 'def-new',
			options: {},
			upgradeIndex: undefined,
		} as SomeReplaceableEntityModel)

		expect(result).toBeUndefined()
	})

	test('returns undefined for an unknown entity', () => {
		const { pool } = createPool()

		const result = pool.entityReplace({
			id: 'nope',
			type: EntityModelType.Action,
			definitionId: 'def-new',
			options: {},
			upgradeIndex: undefined,
		})

		expect(result).toBeUndefined()
	})
})

describe('EntityListPool - entityReplaceAll', () => {
	test('replaces all entities in a list', () => {
		const { pool, reportChange } = createPool()
		pool.entityAdd(downSet(), null, actionModel())
		reportChange.mockClear()

		const ok = pool.entityReplaceAll(downSet(), [actionModel(), actionModel()])

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(2)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true, invalidateAllElements: false })
	})

	test('returns false for an unknown list', () => {
		const { pool } = createPool()

		expect(pool.entityReplaceAll({ stepId: 'missing', setId: 'down' }, [])).toBe(false)
	})
})

describe('EntityListPool - resubscribeEntities', () => {
	test('re-subscribes entities without throwing', () => {
		const { pool, processManager } = createPool()
		pool.entityAdd(downSet(), null, actionModel())
		processManager.connectionEntityUpdate.mockClear()

		expect(() => pool.resubscribeEntities()).not.toThrow()
		expect(processManager.connectionEntityUpdate).toHaveBeenCalled()
	})
})

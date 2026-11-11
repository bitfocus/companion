import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntityModelType, type SomeReplaceableEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlEntityListChangeProps } from '../../../lib/Controls/Entities/EntityListPoolBase.js'
import type { EntityScope } from '../../../lib/Controls/Entities/Types.js'
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

describe('EntityListPool - entityReplaceForUpgrade', () => {
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
		const result = pool.entityReplaceForUpgrade(replacement)

		expect(result?.id).toBe(action.id)
		expect(pool.findEntityById(action.id)?.definitionId).toBe('def-new')
	})

	test('returns undefined when the types do not match', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)

		const result = pool.entityReplaceForUpgrade({
			id: action.id,
			type: EntityModelType.Feedback,
			definitionId: 'def-new',
			options: {},
			upgradeIndex: undefined,
		})

		expect(result).toBeUndefined()
	})

	test('ignores a copy in a transient group, as it is rebuilt once what it copies is upgraded', () => {
		const { pool } = createPool()
		const caller = actionModel()
		pool.entityAdd(downSet(), null, caller)
		const copy = actionModel({ definitionId: 'def-old' })
		const copyScope: EntityScope = {
			isTransient: true,
			specialExpressionManager: { trackEntity: vi.fn(), forgetEntity: vi.fn() } as any,
			customActionChain: [],
			customActionInstances: { entityUpdate: vi.fn(), entityDelete: vi.fn() },
			localVariablesChanged: vi.fn(),
			createVariablesAndExpressionParser: vi.fn(() => ({}) as any),
		}
		const callerEntity = pool.findEntityById(caller.id)!
		const copyList = callerEntity.createTransientList(
			'copy',
			copyScope,
			{ type: EntityModelType.Action },
			[copy],
			false
		)
		callerEntity.setTransientCopy('copy', { lists: [copyList] })

		const result = pool.entityReplaceForUpgrade({
			id: copy.id,
			type: EntityModelType.Action,
			definitionId: 'def-new',
			options: {},
			upgradeIndex: undefined,
		})

		expect(result).toBeUndefined()
		expect(pool.findEntityById(caller.id)!.findChildById(copy.id)?.definitionId).toBe('def-old')
	})

	test('returns undefined for an unknown entity', () => {
		const { pool } = createPool()

		const result = pool.entityReplaceForUpgrade({
			id: 'nope',
			type: EntityModelType.Action,
			definitionId: 'def-new',
			options: {},
			upgradeIndex: undefined,
		})

		expect(result).toBeUndefined()
	})

	test('applies a storeResult from an upgrade when the action has none', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)

		pool.entityReplaceForUpgrade({
			id: action.id,
			type: EntityModelType.Action,
			definitionId: action.definitionId,
			options: {},
			upgradeIndex: undefined,
			storeResult: {
				type: 'custom-variable',
				variableName: { isExpression: false, value: 'myvar' },
				createIfNotExists: false,
			},
		})

		expect(pool.findEntityById(action.id)?.rawStoreResult).toEqual({
			type: 'custom-variable',
			variableName: { isExpression: false, value: 'myvar' },
			createIfNotExists: false,
		})
	})

	test('preserves a user-chosen storeResult over the one from an upgrade', () => {
		const { pool } = createPool()
		const action = actionModel({
			storeResult: {
				type: 'custom-variable',
				variableName: { isExpression: false, value: 'user-choice' },
				createIfNotExists: false,
			},
		})
		pool.entityAdd(downSet(), null, action)

		pool.entityReplaceForUpgrade({
			id: action.id,
			type: EntityModelType.Action,
			definitionId: action.definitionId,
			options: {},
			upgradeIndex: undefined,
			storeResult: {
				type: 'custom-variable',
				variableName: { isExpression: false, value: 'upgrade-choice' },
				createIfNotExists: false,
			},
		})

		expect(pool.findEntityById(action.id)?.rawStoreResult).toEqual({
			type: 'custom-variable',
			variableName: { isExpression: false, value: 'user-choice' },
			createIfNotExists: false,
		})
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

describe('EntityListPool - entityLearn', () => {
	const learnedOptions: ExpressionableOptionsObject = { learned: { isExpression: false, value: 1 } }

	test('learns options and redraws for a feedback', async () => {
		const { pool, reportChange, processManager } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		processManager.connectionEntityLearnOptions.mockResolvedValue(learnedOptions)
		reportChange.mockClear()

		await expect(pool.entityLearn('feedbacks', feedback.id, new AbortController().signal)).resolves.toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true })
	})

	test('learns options without a redraw for an action set', async () => {
		const { pool, reportChange, processManager } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		processManager.connectionEntityLearnOptions.mockResolvedValue(learnedOptions)
		reportChange.mockClear()

		await expect(pool.entityLearn(downSet(), action.id, new AbortController().signal)).resolves.toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
		expect(pool.findEntityById(action.id)?.rawOptions).toMatchObject(learnedOptions)
	})

	test('passes the signal through to the connection', async () => {
		const { pool, processManager } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		const controller = new AbortController()

		await pool.entityLearn(downSet(), action.id, controller.signal)

		expect(processManager.connectionEntityLearnOptions).toHaveBeenCalledWith(
			expect.objectContaining({ id: action.id }),
			expect.any(String),
			controller.signal
		)
	})

	test('returns false when the connection reports no learned changes', async () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		// The default mock resolves null, i.e. nothing was learned
		await expect(pool.entityLearn(downSet(), action.id, new AbortController().signal)).resolves.toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('discards learned options when aborted while the connection is learning', async () => {
		const { pool, reportChange, processManager } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		const optionsBefore = structuredClone(pool.findEntityById(action.id)?.rawOptions)
		const controller = new AbortController()
		processManager.connectionEntityLearnOptions.mockImplementation(async () => {
			// The learn is cancelled (e.g. superseded) before the connection replies
			controller.abort()
			return learnedOptions
		})
		reportChange.mockClear()

		await expect(pool.entityLearn(downSet(), action.id, controller.signal)).resolves.toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
		expect(pool.findEntityById(action.id)?.rawOptions).toEqual(optionsBefore)
	})

	test('returns false and reports no change when already aborted', async () => {
		const { pool, reportChange, processManager } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		processManager.connectionEntityLearnOptions.mockResolvedValue(learnedOptions)
		reportChange.mockClear()

		await expect(pool.entityLearn(downSet(), action.id, AbortSignal.abort())).resolves.toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
		expect(pool.findEntityById(action.id)?.rawOptions).not.toMatchObject(learnedOptions)
	})

	test('returns false when the entity is removed while learning', async () => {
		const { pool, reportChange, processManager } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		processManager.connectionEntityLearnOptions.mockImplementation(async () => {
			pool.entityRemove(downSet(), action.id)
			return learnedOptions
		})
		reportChange.mockClear()

		await expect(pool.entityLearn(downSet(), action.id, new AbortController().signal)).resolves.toBe(false)
		expect(reportChange).not.toHaveBeenCalledWith({ redraw: false })
	})

	test('returns false for an unknown entity', async () => {
		const { pool } = createPool()

		await expect(pool.entityLearn(downSet(), 'nope', new AbortController().signal)).resolves.toBe(false)
	})

	test('returns false for an unknown list', async () => {
		const { pool } = createPool()

		await expect(
			pool.entityLearn({ stepId: 'missing', setId: 'down' }, 'x', new AbortController().signal)
		).resolves.toBe(false)
	})
})

describe('EntityListPool - entitySetRawStoreResult', () => {
	test('sets the store-result target on an action without a redraw', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		const ok = pool.entitySetRawStoreResult(downSet(), action.id, {
			type: 'custom-variable',
			variableName: { isExpression: false, value: 'myvar' },
			createIfNotExists: false,
		})

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
	})

	test('clears the store-result target when passed undefined', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)

		expect(pool.entitySetRawStoreResult(downSet(), action.id, undefined)).toBe(true)
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetRawStoreResult(downSet(), 'nope', undefined)).toBe(false)
	})
})

describe('EntityListPool - entitySetVariableValue', () => {
	test('returns false for a feedback that is not a user-value feedback', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		expect(pool.entitySetVariableValue('feedbacks', feedback.id, 42)).toBe(false)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('returns false for an unknown entity', () => {
		const { pool } = createPool()

		expect(pool.entitySetVariableValue('feedbacks', 'nope', 1)).toBe(false)
	})

	test('returns false for an unknown list', () => {
		const { pool } = createPool()

		expect(pool.entitySetVariableValue({ stepId: 'missing', setId: 'down' }, 'x', 1)).toBe(false)
	})
})

describe('EntityListPool - style overrides', () => {
	const override = {
		overrideId: 'ov1',
		elementId: 'el1',
		elementProperty: 'color',
		override: { isExpression: false as const, value: 0xff0000 },
	}

	test('entityReplaceStyleOverride invalidates the affected element', () => {
		const { pool, reportChange } = createPool({ isLayered: true })
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		const ok = pool.entityReplaceStyleOverride('feedbacks', feedback.id, override)

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true, changedElementIds: new Set(['el1']) })
	})

	test('entityReplaceStyleOverride on a disabled feedback does not redraw', () => {
		const { pool, reportChange } = createPool({ isLayered: true })
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		pool.entityEnabled('feedbacks', feedback.id, false)
		reportChange.mockClear()

		const ok = pool.entityReplaceStyleOverride('feedbacks', feedback.id, override)

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: false, changedElementIds: undefined })
	})

	test('entityRemoveStyleOverride removes a previously added override', () => {
		const { pool, reportChange } = createPool({ isLayered: true })
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		pool.entityReplaceStyleOverride('feedbacks', feedback.id, override)
		reportChange.mockClear()

		const ok = pool.entityRemoveStyleOverride('feedbacks', feedback.id, override.overrideId)

		expect(ok).toBe(true)
		expect(reportChange).toHaveBeenCalledWith({ redraw: true, changedElementIds: new Set(['el1']) })
	})

	test('entityRemoveStyleOverride returns false when the override is not present', () => {
		const { pool } = createPool({ isLayered: true })
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)

		expect(pool.entityRemoveStyleOverride('feedbacks', feedback.id, 'missing')).toBe(false)
	})

	test('entityReplaceStyleOverride returns false for an unknown entity', () => {
		const { pool } = createPool({ isLayered: true })

		expect(pool.entityReplaceStyleOverride('feedbacks', 'nope', override)).toBe(false)
	})
})

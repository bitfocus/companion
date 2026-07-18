import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ButtonModelBase } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlEntityListChangeProps } from '../../../lib/Controls/Entities/EntityListPoolBase.js'
import {
	ControlEntityListPoolButton,
	EditableControlEntityListPoolButton,
} from '../../../lib/Controls/Entities/EntityListPoolButton.js'
import {
	actionModel,
	createPool,
	createPoolDeps,
	downSet,
	feedbackModel,
	feedbackValues,
} from './EntityListPoolTestHelpers.js'

/** A style override carrying the layered-drawing fields the pool reads. */
function styleOverride(overrides: Record<string, unknown> = {}) {
	return {
		overrideId: 'ov1',
		elementId: 'el1',
		elementProperty: 'color',
		override: { isExpression: false as const, value: 0xff0000 },
		...overrides,
	}
}

// The pool schedules debounced timers (e.g. for local-variable/special-expression processing) that
// would otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('EntityListPool - construction', () => {
	test('construction', () => {
		const { pool, reportChange, sendRuntimeProps, variableValues } = createPool()

		expect(pool.getActiveStepIndex()).toBe(0)
		expect(pool.getStepIds()).toEqual(['0'])
		expect(pool.getAllEntities()).toHaveLength(0)
		expect(sendRuntimeProps).toHaveBeenCalledTimes(0)
		expect(variableValues.createVariablesAndExpressionParser).toHaveBeenCalledTimes(0)
		expect(reportChange).toHaveBeenCalledTimes(0)
	})

	test('starts with the down and up action sets on the first step', () => {
		const { pool } = createPool()

		const stepActions = pool.getStepActions('0')
		expect(stepActions).toBeDefined()
		expect([...(stepActions?.sets.keys() ?? [])]).toEqual(['down', 'up'])
	})
})

describe('EntityListPool - queries', () => {
	test('findEntityById searches across all lists', () => {
		const { pool } = createPool()

		const action = actionModel()
		const feedback = feedbackModel()
		pool.entityAdd(downSet(), null, action)
		pool.entityAdd('feedbacks', null, feedback)

		expect(pool.findEntityById(action.id)?.id).toBe(action.id)
		expect(pool.findEntityById(feedback.id)?.id).toBe(feedback.id)
		expect(pool.findEntityById('does-not-exist')).toBeUndefined()
	})

	test('getAllEntities returns entities from every list', () => {
		const { pool } = createPool()

		pool.entityAdd(downSet(), null, actionModel())
		pool.entityAdd({ stepId: '0', setId: 'up' }, null, actionModel())
		pool.entityAdd('feedbacks', null, feedbackModel())

		expect(pool.getAllEntities()).toHaveLength(3)
	})

	test('getAllEntitiesInList returns only the requested list', () => {
		const { pool } = createPool()

		pool.entityAdd(downSet(), null, actionModel())
		pool.entityAdd(downSet(), null, actionModel())
		pool.entityAdd('feedbacks', null, feedbackModel())

		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(2)
		expect(pool.getAllEntitiesInList('feedbacks')).toHaveLength(1)
	})

	test('getAllEntitiesInList for an unknown list is empty', () => {
		const { pool } = createPool()

		expect(pool.getAllEntitiesInList({ stepId: 'nope', setId: 'down' })).toEqual([])
	})

	test('getAllEntitiesInList recursive includes children', () => {
		const { pool } = createPool({
			getEntityDefinition: (entityType, connectionId, definitionId) => {
				if (connectionId === 'internal' && definitionId === 'with-children') {
					return {
						entityType,
						supportsChildGroups: [{ type: entityType, groupId: 'default', entityTypeLabel: 'x', label: 'x' }],
					} as any
				}
				return { entityType } as any
			},
		})

		const parent = actionModel({ connectionId: 'internal', definitionId: 'with-children' })
		pool.entityAdd(downSet(), null, parent)
		const child = actionModel()
		pool.entityAdd(downSet(), { parentId: parent.id, childGroup: 'default' }, child)

		expect(pool.getAllEntitiesInList(downSet())).toHaveLength(1) // direct only
		expect(pool.getAllEntitiesInList(downSet(), true)).toHaveLength(2) // recursive
	})
})

describe('EntityListPool - connection management', () => {
	test('forgetConnection removes referencing entities and reports an invalidating change', () => {
		const { pool, reportChange } = createPool()

		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-to-forget' }))
		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-keep' }))
		reportChange.mockClear()

		pool.forgetConnection('conn-to-forget')

		expect(pool.getAllEntities()).toHaveLength(1)
		expect(reportChange).toHaveBeenCalledWith({
			redraw: true,
			invalidateAllElements: true,
		} satisfies ControlEntityListChangeProps)
	})

	test('forgetConnection for an unreferenced connection does not report a change', () => {
		const { pool, reportChange } = createPool()

		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-keep' }))
		reportChange.mockClear()

		pool.forgetConnection('conn-unknown')

		expect(pool.getAllEntities()).toHaveLength(1)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('verifyConnectionIds prunes entities for unknown connections', () => {
		const { pool, reportChange } = createPool()

		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-known' }))
		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-stale' }))
		reportChange.mockClear()

		pool.verifyConnectionIds(new Set(['conn-known', 'internal']))

		expect(pool.getAllEntities()).toHaveLength(1)
		expect(reportChange).toHaveBeenCalledWith({
			redraw: true,
			invalidateAllElements: true,
		} satisfies ControlEntityListChangeProps)
	})

	test('verifyConnectionIds with all connections known reports nothing', () => {
		const { pool, reportChange } = createPool()

		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-known' }))
		reportChange.mockClear()

		pool.verifyConnectionIds(new Set(['conn-known']))

		expect(reportChange).not.toHaveBeenCalled()
	})

	test('getAllEnabledConnectionIds collects connection ids from enabled entities', () => {
		const { pool } = createPool()

		pool.entityAdd(downSet(), null, actionModel({ connectionId: 'conn-a' }))
		pool.entityAdd({ stepId: '0', setId: 'up' }, null, actionModel({ connectionId: 'conn-b' }))

		const ids = pool.getAllEnabledConnectionIds()
		expect(ids.has('conn-a')).toBe(true)
		expect(ids.has('conn-b')).toBe(true)
	})
})

describe('EntityListPool - destroy', () => {
	test('destroy cleans up without throwing', () => {
		const { pool } = createPool()

		pool.entityAdd(downSet(), null, actionModel())
		pool.entityAdd('feedbacks', null, feedbackModel())

		expect(() => pool.destroy()).not.toThrow()
	})
})

describe('EntityListPool - read-only by construction', () => {
	test('the isEditable discriminant distinguishes the two pools', () => {
		const readonly = new ControlEntityListPoolButton(createPoolDeps({ controlId: 'disc0' }).deps, vi.fn(), true)
		const editable = new EditableControlEntityListPoolButton(
			createPoolDeps({ controlId: 'disc1' }).deps,
			vi.fn(),
			vi.fn(),
			true
		)

		expect(readonly.isEditable).toBe(false)
		expect(editable.isEditable).toBe(true)
	})

	test('the read-only pool structurally lacks the edit mutators', () => {
		const pool = new ControlEntityListPoolButton(createPoolDeps({ controlId: 'ro00' }).deps, vi.fn(), true)

		// Compile-time: these properties do not exist on the read-only pool type.
		// Runtime: confirm they are genuinely absent (not merely guarded).
		// @ts-expect-error stepAdd is only on the editable pool
		expect(typeof pool.stepAdd).toBe('undefined')
		// @ts-expect-error entityAdd is only on the editable pool
		expect(typeof pool.entityAdd).toBe('undefined')
		// @ts-expect-error actionSetAdd is only on the editable pool
		expect(typeof pool.actionSetAdd).toBe('undefined')
		// @ts-expect-error stepRename is only on the editable pool
		expect(typeof pool.stepRename).toBe('undefined')
	})

	test('the editable pool has working edit mutators', () => {
		const pool = new EditableControlEntityListPoolButton(
			createPoolDeps({ controlId: 'rw00' }).deps,
			vi.fn(),
			vi.fn(),
			true
		)

		expect(typeof pool.stepAdd).toBe('function')
		pool.stepAdd()
		expect(pool.getStepIds()).toEqual(['0', '1'])
	})

	test('loading and runtime step navigation work on the read-only pool', () => {
		const pool = new ControlEntityListPoolButton(createPoolDeps({ controlId: 'ro01' }).deps, vi.fn(), true)

		// Loading the cached data must work on a read-only pool
		expect(() => pool.loadStorage({ feedbacks: [], steps: {}, localVariables: [] }, true, false)).not.toThrow()

		// Runtime step navigation (used by pressControl) must work
		expect(() => pool.stepSelectCurrent('0')).not.toThrow()
	})
})

describe('EntityListPool - local variables', () => {
	test('getLocalVariableValues strips the local: prefix from variable names', () => {
		const { pool } = createPool()

		pool.entityAdd('local-variables', null, feedbackModel({ variableName: 'foo' }))

		expect(Object.keys(pool.getLocalVariableValues())).toEqual(['foo'])
	})

	test('getLocalVariableValues ignores entities without a variable name', () => {
		const { pool } = createPool()

		pool.entityAdd('local-variables', null, feedbackModel())

		expect(pool.getLocalVariableValues()).toEqual({})
	})

	test('createVariablesAndExpressionParser delegates to the variable-values factory', () => {
		const { pool, variableValues } = createPool()

		pool.createVariablesAndExpressionParser(null)

		// controlLocation comes from the (mocked) pageStore which returns null, and there are no
		// local-variable entities yet
		expect(variableValues.createVariablesAndExpressionParser).toHaveBeenCalledWith(null, [], null)
	})
})

describe('EntityListPool - updateFeedbackValues (button)', () => {
	test('reports a no-save redraw when a feedback value changes', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: true }))

		expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true, changedElementIds: undefined })
	})

	test('includes the affected element ids for feedbacks carrying style overrides', () => {
		const { pool, reportChange } = createPool({ isLayered: true })
		const feedback = feedbackModel({ styleOverrides: [styleOverride()] })
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: true }))

		expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true, changedElementIds: new Set(['el1']) })
	})

	test('is a no-op for values that match no entity', () => {
		const { pool, reportChange } = createPool()
		pool.entityAdd('feedbacks', null, feedbackModel())
		reportChange.mockClear()

		pool.updateFeedbackValues('conn01', feedbackValues({ 'unrelated-id': true }))

		expect(reportChange).not.toHaveBeenCalled()
	})
})

describe('EntityListPool - updateIsInvertedValues (button)', () => {
	test('reports a no-save redraw when a feedback inversion changes', () => {
		const { pool, reportChange } = createPool()
		const feedback = feedbackModel()
		pool.entityAdd('feedbacks', null, feedback)
		reportChange.mockClear()

		pool.updateIsInvertedValues(new Map([[feedback.id, { entityId: feedback.id, controlId: '', value: true }]]))

		expect(reportChange).toHaveBeenCalledWith({ redraw: true, noSave: true, changedElementIds: undefined })
	})

	test('is a no-op when no inversion values match', () => {
		const { pool, reportChange } = createPool()
		pool.entityAdd('feedbacks', null, feedbackModel())
		reportChange.mockClear()

		pool.updateIsInvertedValues(new Map([['unrelated-id', { entityId: 'unrelated-id', controlId: '', value: true }]]))

		expect(reportChange).not.toHaveBeenCalled()
	})
})

describe('EntityListPool - updateStoreResultValues (button)', () => {
	test('applies store-result values to action sets without throwing', () => {
		const { pool, reportChange } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet(), null, action)
		reportChange.mockClear()

		expect(() =>
			pool.updateStoreResultValues(new Map([[action.id, { entityId: action.id, controlId: '', value: undefined }]]))
		).not.toThrow()
	})
})

describe('EntityListPool - getFeedbackStyleOverrides (layered button)', () => {
	test('flattens overrides of an active boolean feedback into elementId -> property -> value', () => {
		const { pool } = createPool({ isLayered: true })
		const feedback = feedbackModel({ styleOverrides: [styleOverride()] })
		pool.entityAdd('feedbacks', null, feedback)
		pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: true }))

		const overrides = pool.getFeedbackStyleOverrides()

		expect(overrides.get('el1')?.get('color')).toEqual({ isExpression: false, value: 0xff0000 })
	})

	test('a boolean feedback that is false contributes no overrides', () => {
		const { pool } = createPool({ isLayered: true })
		const feedback = feedbackModel({ styleOverrides: [styleOverride()] })
		pool.entityAdd('feedbacks', null, feedback)
		pool.updateFeedbackValues('conn01', feedbackValues({ [feedback.id]: false }))

		expect(pool.getFeedbackStyleOverrides().size).toBe(0)
	})
})

describe('EntityListPool - storage round-trip (button)', () => {
	function buttonStorage(overrides: Partial<ButtonModelBase> = {}): ButtonModelBase {
		return {
			feedbacks: [],
			localVariables: [],
			steps: {},
			...overrides,
		}
	}

	test('loadStorage routes feedbacks, local variables and steps into their lists', () => {
		const { pool } = createPool()

		pool.loadStorage(
			buttonStorage({
				feedbacks: [feedbackModel()],
				localVariables: [feedbackModel(), feedbackModel()],
				steps: {
					'0': {
						action_sets: { down: [actionModel()], up: [], rotate_left: undefined, rotate_right: undefined },
						options: { runWhileHeld: [] },
					},
					'1': {
						action_sets: { down: [], up: [actionModel()], rotate_left: undefined, rotate_right: undefined },
						options: { runWhileHeld: [] },
					},
				},
			}),
			true,
			false
		)

		expect(pool.getStepIds()).toEqual(['0', '1'])
		expect(pool.getAllEntitiesInList(downSet('0'))).toHaveLength(1)
		expect(pool.getAllEntitiesInList({ stepId: '1', setId: 'up' })).toHaveLength(1)
		expect(pool.getLocalVariableEntities()).toHaveLength(2)
	})

	test('asNormalButtonSteps mirrors the loaded steps for a round-trip', () => {
		const { pool } = createPool()
		const action = actionModel({ definitionId: 'round-trip-action' })

		pool.loadStorage(
			buttonStorage({
				steps: {
					'0': {
						action_sets: { down: [action], up: [], rotate_left: undefined, rotate_right: undefined },
						options: { runWhileHeld: [] },
					},
				},
			}),
			true,
			false
		)

		const steps = pool.asNormalButtonSteps()
		expect(Object.keys(steps)).toEqual(['0'])
		// loadStorage clones the entities (assigning fresh ids), so assert on the preserved content
		expect(steps['0'].action_sets.down).toHaveLength(1)
		expect(steps['0'].action_sets.down?.[0].definitionId).toBe('round-trip-action')
	})
})

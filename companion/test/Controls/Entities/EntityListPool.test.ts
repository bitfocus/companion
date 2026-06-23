import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlEntityListChangeProps } from '../../../lib/Controls/Entities/EntityListPoolBase.js'
import { actionModel, createPool, downSet, feedbackModel } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (e.g. for local-variable/special-expression processing) that
// would otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('EntityListPool - construction', () => {
	test('construction', () => {
		const { pool, reportChange, sendRuntimeProps, executeExpressionInControl } = createPool()

		expect(pool.getActiveStepIndex()).toBe(0)
		expect(pool.getStepIds()).toEqual(['0'])
		expect(pool.getAllEntities()).toHaveLength(0)
		expect(sendRuntimeProps).toHaveBeenCalledTimes(0)
		expect(executeExpressionInControl).toHaveBeenCalledTimes(0)
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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actionModel, createPool, downSet } from './EntityListPoolTestHelpers.js'

// The pool schedules debounced timers (e.g. for local-variable/special-expression processing) that
// would otherwise outlive the test and race vitest's worker teardown. Fake timers keep them inert.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('EntityListPool - stepAdd / stepRemove', () => {
	test('stepAdd appends a new step with sequential id', () => {
		const { pool, reportChange } = createPool()

		const newId = pool.stepAdd()

		expect(newId).toBe('1')
		expect(pool.getStepIds()).toEqual(['0', '1'])
		expect(reportChange).toHaveBeenCalledWith({ redraw: true })
	})

	test('stepRemove deletes a step', () => {
		const { pool } = createPool()
		pool.stepAdd()

		const ok = pool.stepRemove('1')

		expect(ok).toBe(true)
		expect(pool.getStepIds()).toEqual(['0'])
	})

	test('stepRemove refuses to remove the final step', () => {
		const { pool } = createPool()

		expect(pool.stepRemove('0')).toBe(false)
		expect(pool.getStepIds()).toEqual(['0'])
	})

	test('stepRemove returns false for an unknown step', () => {
		const { pool } = createPool()
		pool.stepAdd()

		expect(pool.stepRemove('nope')).toBe(false)
		expect(pool.getStepIds()).toEqual(['0', '1'])
	})

	test('removing the current step advances the current step', () => {
		const { pool, sendRuntimeProps } = createPool()
		pool.stepAdd() // '1'
		pool.stepSelectCurrent('0')
		sendRuntimeProps.mockClear()

		pool.stepRemove('0')

		expect(pool.getStepIds()).toEqual(['1'])
		expect(pool.getActiveStepIndex()).toBe(0)
		expect(sendRuntimeProps).toHaveBeenCalled()
	})
})

describe('EntityListPool - stepDuplicate', () => {
	test('duplicates a step including its actions', () => {
		const { pool } = createPool()
		pool.entityAdd(downSet('0'), null, actionModel())

		const ok = pool.stepDuplicate('0')

		expect(ok).toBe(true)
		expect(pool.getStepIds()).toEqual(['0', '1'])
		expect(pool.getAllEntitiesInList(downSet('1'))).toHaveLength(1)
	})

	test('returns false for an unknown step', () => {
		const { pool } = createPool()

		expect(pool.stepDuplicate('nope')).toBe(false)
	})
})

describe('EntityListPool - stepSwap', () => {
	test('swaps the contents of two steps', () => {
		const { pool } = createPool()
		const a = actionModel()
		pool.entityAdd(downSet('0'), null, a)
		pool.stepAdd() // '1'
		const b = actionModel()
		pool.entityAdd(downSet('1'), null, b)

		const ok = pool.stepSwap('0', '1')

		expect(ok).toBe(true)
		expect(pool.getAllEntitiesInList(downSet('0')).map((e) => e.id)).toEqual([b.id])
		expect(pool.getAllEntitiesInList(downSet('1')).map((e) => e.id)).toEqual([a.id])
	})

	test('returns false when a step is missing', () => {
		const { pool } = createPool()

		expect(pool.stepSwap('0', 'nope')).toBe(false)
	})
})

describe('EntityListPool - current step navigation', () => {
	test('stepSelectCurrent sets the active step', () => {
		const { pool, sendRuntimeProps } = createPool()
		pool.stepAdd() // '1'
		sendRuntimeProps.mockClear()

		const ok = pool.stepSelectCurrent('1')

		expect(ok).toBe(true)
		expect(pool.getActiveStepIndex()).toBe(1)
		expect(sendRuntimeProps).toHaveBeenCalled()
	})

	test('stepSelectCurrent returns false for an unknown step', () => {
		const { pool } = createPool()

		expect(pool.stepSelectCurrent('nope')).toBe(false)
	})

	test('stepMakeCurrent selects by 1-based index', () => {
		const { pool } = createPool()
		pool.stepAdd() // '1'

		expect(pool.stepMakeCurrent(2)).toBe(true)
		expect(pool.getActiveStepIndex()).toBe(1)
	})

	test('stepAdvanceDelta wraps around the steps', () => {
		const { pool } = createPool()
		pool.stepAdd() // '1'
		pool.stepSelectCurrent('1')

		expect(pool.stepAdvanceDelta(1)).toBe(true)
		expect(pool.getActiveStepIndex()).toBe(0) // wrapped back to first
	})

	test('stepAdvanceDelta of 0 is a no-op', () => {
		const { pool } = createPool()
		pool.stepAdd()

		expect(pool.stepAdvanceDelta(0)).toBe(false)
	})
})

describe('EntityListPool - stepRename', () => {
	test('renames a step', () => {
		const { pool, reportChange } = createPool()
		reportChange.mockClear()

		const ok = pool.stepRename('0', 'Intro')

		expect(ok).toBe(true)
		expect(pool.getStepActions('0')?.options.name).toBe('Intro')
		expect(reportChange).toHaveBeenCalledWith({ redraw: false })
	})

	test('returns false for an unknown step', () => {
		const { pool } = createPool()

		expect(pool.stepRename('nope', 'x')).toBe(false)
	})
})

describe('EntityListPool - action sets', () => {
	test('actionSetAdd creates the first numbered set at 1000', () => {
		const { pool } = createPool()

		const ok = pool.actionSetAdd('0')

		expect(ok).toBe(true)
		const sets = [...(pool.getStepActions('0')?.sets.keys() ?? [])]
		expect(sets).toContain(1000)
	})

	test('actionSetAdd adds subsequent sets after the last', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		pool.actionSetAdd('0')

		const sets = [...(pool.getStepActions('0')?.sets.keys() ?? [])]
		expect(sets).toContain(1000)
		expect(sets).toContain(2000)
	})

	test('actionSetAdd returns false for an unknown step', () => {
		const { pool } = createPool()

		expect(pool.actionSetAdd('nope')).toBe(false)
	})

	test('actionSetRemove removes a set', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		const ok = pool.actionSetRemove('0', 1000)

		expect(ok).toBe(true)
		expect([...(pool.getStepActions('0')?.sets.keys() ?? [])]).not.toContain(1000)
	})

	test('actionSetRemove returns false for a non-numeric set', () => {
		const { pool } = createPool()

		expect(pool.actionSetRemove('0', 'down')).toBe(false)
	})

	test('actionSetRename renames a numbered set', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0') // 1000

		const ok = pool.actionSetRename('0', 1000, 2000)

		expect(ok).toBe(true)
		const sets = [...(pool.getStepActions('0')?.sets.keys() ?? [])]
		expect(sets).toContain(2000)
		expect(sets).not.toContain(1000)
	})

	test('actionSetRename refuses to clobber an existing set', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0') // 1000
		pool.actionSetAdd('0') // 2000

		expect(pool.actionSetRename('0', 1000, 2000)).toBe(false)
	})

	test('actionSetRunWhileHeld toggles the runWhileHeld option', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0') // 1000

		expect(pool.actionSetRunWhileHeld('0', 1000, true)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toContain(1000)

		expect(pool.actionSetRunWhileHeld('0', 1000, false)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).not.toContain(1000)
	})
})

describe('EntityListPool - step progression', () => {
	test('validateCurrentStepIdAndGetNextProgression returns current and next steps', () => {
		const { pool } = createPool()
		pool.stepAdd() // '1'
		pool.stepAdd() // '2'
		pool.stepSelectCurrent('1')

		expect(pool.validateCurrentStepIdAndGetNextProgression()).toEqual(['1', '2'])
	})

	test('the next step wraps back to the first', () => {
		const { pool } = createPool()
		pool.stepAdd() // '1'
		pool.stepSelectCurrent('1')

		// current is the last step, so the next wraps to '0'
		expect(pool.validateCurrentStepIdAndGetNextProgression()).toEqual(['1', '0'])
	})

	test('current step at index 0 reports itself and the following step', () => {
		const { pool } = createPool()
		pool.stepAdd() // '1'
		pool.stepSelectCurrent('0')

		expect(pool.validateCurrentStepIdAndGetNextProgression()).toEqual(['0', '1'])
	})

	test('getActionsToExecuteForSet returns the current step actions for a set', () => {
		const { pool } = createPool()
		const action = actionModel()
		pool.entityAdd(downSet('0'), null, action)

		const actions = pool.getActionsToExecuteForSet('down')

		expect(actions.map((e) => e.id)).toEqual([action.id])
	})

	test('getActionsToExecuteForSet is empty for an unknown set', () => {
		const { pool } = createPool()

		expect(pool.getActionsToExecuteForSet(9999)).toEqual([])
	})
})

describe('EntityListPool - rotary action sets', () => {
	test('setupRotaryActionSets creates and removes rotary sets', () => {
		const { pool } = createPool()

		pool.setupRotaryActionSets(true)
		let sets = [...(pool.getStepActions('0')?.sets.keys() ?? [])]
		expect(sets).toContain('rotate_left')
		expect(sets).toContain('rotate_right')

		pool.setupRotaryActionSets(false)
		sets = [...(pool.getStepActions('0')?.sets.keys() ?? [])]
		expect(sets).not.toContain('rotate_left')
		expect(sets).not.toContain('rotate_right')
	})
})

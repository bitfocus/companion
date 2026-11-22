import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CreateBankControlId } from '@companion-app/shared/ControlId.js'
import type { ButtonModelBase } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlEntityListPoolButton } from '../../../lib/Controls/Entities/EntityListPoolButton.js'
import { actionModel, createPool, createPoolDeps, downSet } from './EntityListPoolTestHelpers.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('button action-set surface cue preferences', () => {
	test('defaults existing press groups to enabled', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'up')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 1000)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 2000)).toBe(false)
		expect(pool.isActionSetControlEventsEnabled('missing', 'down')).toBe(false)
	})

	test('defaults surface cues when a pre-cue button is imported', () => {
		const { pool } = createPool()
		const exported = {
			feedbacks: [],
			localVariables: [],
			steps: {
				'0': { action_sets: { down: [actionModel()], 1000: [actionModel()] }, options: { runWhileHeld: [1000] } },
			},
		} as unknown as ButtonModelBase

		pool.loadStorage(exported, true)

		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 1000)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toEqual([1000])
	})

	test('enabling a cue clears every stored opt-out for that group', () => {
		const { pool } = createPool()
		pool.loadStorage(
			{
				feedbacks: [],
				localVariables: [],
				steps: {
					'0': {
						action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
						options: { runWhileHeld: [], controlEventsDisabledSets: ['down', 'up', 'down'] },
					},
				},
			},
			false
		)

		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'up')).toBe(false)
	})

	test('persists toggles through a storage round-trip', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		expect(pool.actionSetControlEvents('0', 'down', false)).toBe(true)
		expect(pool.actionSetControlEvents('0', 1000, false)).toBe(true)

		const { pool: reloadedPool } = createPool()
		reloadedPool.loadStorage(
			{
				feedbacks: [],
				localVariables: [],
				steps: structuredClone(pool.asNormalButtonSteps()),
			},
			false
		)

		expect(reloadedPool.isActionSetControlEventsEnabled('0', 'down')).toBe(false)
		expect(reloadedPool.isActionSetControlEventsEnabled('0', 'up')).toBe(true)
		expect(reloadedPool.isActionSetControlEventsEnabled('0', 1000)).toBe(false)
	})

	test('only changes groups that exist', () => {
		const { pool } = createPool()

		expect(pool.actionSetControlEvents('0', 1000, false)).toBe(false)
		expect(pool.actionSetControlEvents('missing', 'down', false)).toBe(false)

		expect(pool.actionSetControlEvents('0', 'down', false)).toBe(true)
		expect(pool.getStepActions('0')?.options.controlEventsDisabledSets).toEqual(['down'])
		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(pool.getStepActions('0')?.options.controlEventsDisabledSets).toEqual([])
	})

	test('does not report a change when the requested preference already matches', () => {
		const { pool, reportChange } = createPool()

		reportChange.mockClear()
		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()

		expect(pool.actionSetControlEvents('0', 'down', false)).toBe(true)
		expect(reportChange).toHaveBeenCalledTimes(1)

		reportChange.mockClear()
		expect(pool.actionSetControlEvents('0', 'down', false)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()

		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(reportChange).toHaveBeenCalledTimes(1)

		reportChange.mockClear()
		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('renames and removes duration metadata with the action group', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')
		pool.actionSetRunWhileHeld('0', 1000, true)
		pool.actionSetControlEvents('0', 1000, false)

		expect(pool.actionSetRename('0', 1000, 1250)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toEqual([1250])
		expect(pool.getStepActions('0')?.options.controlEventsDisabledSets).toEqual([1250])
		expect(pool.isActionSetControlEventsEnabled('0', 1250)).toBe(false)

		expect(pool.actionSetRemove('0', 1250)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toEqual([])
		expect(pool.getStepActions('0')?.options.controlEventsDisabledSets).toEqual([])
	})

	test('a new duration group does not inherit duplicate opt-outs left by a rename', () => {
		const { pool } = createPool()
		pool.loadStorage(
			{
				feedbacks: [],
				localVariables: [],
				steps: {
					'0': {
						action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined, 1000: [] },
						options: { runWhileHeld: [], controlEventsDisabledSets: [1000, 'up', 1000] },
					},
				},
			},
			false
		)

		expect(pool.actionSetRename('0', 1000, 2000)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 2000)).toBe(false)
		expect(pool.actionSetRemove('0', 2000)).toBe(true)
		expect(pool.actionSetAdd('0')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 1000)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'up')).toBe(false)
	})

	test('duplicates preferences independently and leaves them unchanged when copying an action leaf', () => {
		const { pool } = createPool()
		pool.entityAdd(downSet(), null, actionModel())
		pool.actionSetControlEvents('0', 'down', false)

		expect(pool.stepDuplicate('0')).toBe(true)
		expect(pool.actionSetControlEvents('0', 'down', true)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('1', 'down')).toBe(false)

		const copiedActionId = pool.getAllEntitiesInList(downSet('1'))[0]?.id
		expect(copiedActionId).toBeTruthy()
		expect(pool.entityDuplicate(downSet('1'), copiedActionId)).toBe(true)
		expect(pool.isActionSetControlEventsEnabled('1', 'down')).toBe(false)
	})

	test('keeps preference editing unavailable on read-only pools', () => {
		const pool = new ControlEntityListPoolButton(
			createPoolDeps({ controlId: CreateBankControlId('readonly') }).deps,
			vi.fn(),
			true
		)

		expect(pool.isActionSetControlEventsEnabled('0', 'down')).toBe(true)
		// @ts-expect-error actionSetControlEvents is only on the editable pool
		expect(typeof pool.actionSetControlEvents).toBe('undefined')
	})
})

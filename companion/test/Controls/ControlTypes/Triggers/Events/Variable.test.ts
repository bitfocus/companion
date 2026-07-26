import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TriggersEventVariables } from '../../../../../lib/Controls/ControlTypes/Triggers/Events/Variable.js'
import { TriggerExecutionSource } from '../../../../../lib/Controls/ControlTypes/Triggers/TriggerExecutionSource.js'
import type { TriggerEvents } from '../../../../../lib/Controls/TriggerEvents.js'

const CONTROL_ID = 'control-1'
const WATCHED = 'custom:loop'
const THROTTLE_MS = 50
const RATE_LIMIT_CLEAR_MS = 1000

describe('TriggersEventVariables', () => {
	let bus: EventEmitter
	let executeActions: ReturnType<typeof vi.fn>
	let setRateLimited: ReturnType<typeof vi.fn>
	let events: TriggersEventVariables

	beforeEach(() => {
		vi.useFakeTimers()
		bus = new EventEmitter()
		executeActions = vi.fn()
		setRateLimited = vi.fn()
		events = new TriggersEventVariables(
			bus as unknown as TriggerEvents,
			CONTROL_ID,
			executeActions as any,
			setRateLimited as any
		)
		events.setEnabled(true)
		events.setVariableChanged('e1', WATCHED)
	})

	afterEach(() => {
		events.destroy()
		vi.useRealTimers()
	})

	function emit(variables: string[] = [WATCHED], fromControlId: string | null = null): void {
		bus.emit('variables_changed', new Set(variables), fromControlId == null ? null : new Set([fromControlId]))
	}

	test('a single isolated change fires exactly once, immediately', () => {
		emit()
		expect(executeActions).toHaveBeenCalledTimes(1)
		expect(executeActions).toHaveBeenCalledWith(expect.any(Number), TriggerExecutionSource.Other)

		// No trailing execution should ever follow a single change
		vi.advanceTimersByTime(RATE_LIMIT_CLEAR_MS + THROTTLE_MS)
		expect(executeActions).toHaveBeenCalledTimes(1)

		// And it was never considered rate-limited
		expect(setRateLimited).not.toHaveBeenCalled()
	})

	test('a burst of changes is coalesced into the leading edge plus one trailing execution', () => {
		emit() // leading - fires now
		emit()
		emit()
		emit() // all within the window - coalesced
		expect(executeActions).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(THROTTLE_MS)
		expect(executeActions).toHaveBeenCalledTimes(2)

		// Nothing more once it goes quiet
		vi.advanceTimersByTime(THROTTLE_MS)
		expect(executeActions).toHaveBeenCalledTimes(2)
	})

	test('a sustained loop keeps firing, but at the throttled rate', () => {
		// Simulate a feedback loop: each execution causes another change
		for (let i = 0; i < 10; i++) {
			emit()
			vi.advanceTimersByTime(THROTTLE_MS)
		}

		// ~1 execution per throttle window, not one per emit
		const calls = executeActions.mock.calls.length
		expect(calls).toBeGreaterThanOrEqual(9)
		expect(calls).toBeLessThanOrEqual(11)
	})

	test('flags rate-limited while looping and clears it once the loop stops', () => {
		emit() // leading, not yet rate-limited
		expect(setRateLimited).not.toHaveBeenCalled()

		// Drive a loop for longer than the clear timeout
		for (let i = 0; i < 30; i++) {
			emit()
			vi.advanceTimersByTime(THROTTLE_MS)
		}

		// Flag was raised exactly once and never cleared while the loop continued
		expect(setRateLimited).toHaveBeenCalledWith(true)
		expect(setRateLimited.mock.calls.filter(([v]) => v === true)).toHaveLength(1)
		expect(setRateLimited).not.toHaveBeenCalledWith(false)

		// Once it goes quiet, the flag clears (once)
		vi.advanceTimersByTime(RATE_LIMIT_CLEAR_MS)
		expect(setRateLimited).toHaveBeenLastCalledWith(false)
		expect(setRateLimited.mock.calls.filter(([v]) => v === false)).toHaveLength(1)
	})

	test('ignores changes to variables that are not watched', () => {
		emit(['custom:other'])
		vi.advanceTimersByTime(THROTTLE_MS)
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('ignores changes scoped to a different control', () => {
		emit([WATCHED], 'some-other-control')
		expect(executeActions).not.toHaveBeenCalled()

		// But changes scoped to this control are handled
		emit([WATCHED], CONTROL_ID)
		expect(executeActions).toHaveBeenCalledTimes(1)
	})

	test('does not fire when disabled', () => {
		events.setEnabled(false)
		emit()
		vi.advanceTimersByTime(THROTTLE_MS)
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('destroy cancels a pending trailing execution and clears the rate-limited flag', () => {
		emit() // leading
		emit() // schedules a trailing run + raises rate-limited flag
		expect(executeActions).toHaveBeenCalledTimes(1)
		expect(setRateLimited).toHaveBeenCalledWith(true)

		events.destroy()

		// The pending trailing execution must not fire after destroy
		vi.advanceTimersByTime(RATE_LIMIT_CLEAR_MS + THROTTLE_MS)
		expect(executeActions).toHaveBeenCalledTimes(1)

		// And the flag is cleared on destroy
		expect(setRateLimited).toHaveBeenLastCalledWith(false)
	})
})

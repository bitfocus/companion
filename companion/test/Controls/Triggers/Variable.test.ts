import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { TriggersEventVariables } from '../../../lib/Controls/ControlTypes/Triggers/Events/Variable.js'
import { TriggerExecutionSource } from '../../../lib/Controls/ControlTypes/Triggers/TriggerExecutionSource.js'
import { MockTriggerEventBus } from './Helpers.js'

const CONTROL_ID = 'trigger:test'

function createVariables() {
	const bus = new MockTriggerEventBus()
	const executeActions = vi.fn()
	const setRateLimited = vi.fn()
	const variables = new TriggersEventVariables(bus.asTriggerEvents(), CONTROL_ID, executeActions, setRateLimited)
	return { bus, variables, executeActions, setRateLimited }
}

describe('TriggersEventVariables', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
		})
		vi.setSystemTime(new Date(2026, 5, 8, 10, 0, 0))
	})
	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	test('fires when a watched variable changes', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:time_hms')

		bus.emit('variables_changed', new Set(['internal:time_hms', 'internal:unrelated']), null)
		vi.runAllTimers()
		expect(executeActions).toHaveBeenCalledTimes(1)
		expect(executeActions).toHaveBeenCalledWith(Date.now(), TriggerExecutionSource.Other)
	})

	test('ignores changes to unwatched variables', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:time_hms')

		bus.emit('variables_changed', new Set(['internal:other']), null)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('multiple watched variables changing at once execute the actions once', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:one')
		variables.setVariableChanged('b', 'internal:two')

		bus.emit('variables_changed', new Set(['internal:one', 'internal:two']), null)
		vi.runAllTimers()
		expect(executeActions).toHaveBeenCalledTimes(1)
	})

	test('changes scoped to another control are ignored', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'local:my_var')

		bus.emit('variables_changed', new Set(['local:my_var']), new Set(['trigger:some-other-trigger']))
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('changes scoped to this control fire', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'local:my_var')

		bus.emit('variables_changed', new Set(['local:my_var']), new Set([CONTROL_ID]))
		vi.runAllTimers()
		expect(executeActions).toHaveBeenCalledTimes(1)
	})

	test('does not fire when disabled', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setVariableChanged('a', 'internal:time_hms')

		bus.emit('variables_changed', new Set(['internal:time_hms']), null)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('clearVariableChanged stops the event', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:time_hms')
		variables.clearVariableChanged('a')

		bus.emit('variables_changed', new Set(['internal:time_hms']), null)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})

	test('replacing a watch with the same id discards the old variable', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:one')
		variables.setVariableChanged('a', 'internal:two')

		bus.emit('variables_changed', new Set(['internal:one']), null)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()

		bus.emit('variables_changed', new Set(['internal:two']), null)
		vi.runAllTimers()
		expect(executeActions).toHaveBeenCalledTimes(1)
	})

	test('destroy detaches from the event bus', () => {
		const { bus, variables, executeActions } = createVariables()
		variables.setEnabled(true)
		variables.setVariableChanged('a', 'internal:time_hms')
		variables.destroy()

		bus.emit('variables_changed', new Set(['internal:time_hms']), null)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})

	describe('throttling and rate-limiting', () => {
		// VARIABLE_TRIGGER_THROTTLE_MS = 50, RATE_LIMIT_CLEAR_MS = 1000

		test('rapid changes coalesce into a leading edge plus one trailing execution', () => {
			const { bus, variables, executeActions } = createVariables()
			variables.setEnabled(true)
			variables.setVariableChanged('a', 'internal:v')

			// The first change in an idle period fires immediately (leading edge)
			bus.emit('variables_changed', new Set(['internal:v']), null)
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Further changes inside the 50ms window are coalesced, not executed immediately
			vi.advanceTimersByTime(10)
			bus.emit('variables_changed', new Set(['internal:v']), null)
			vi.advanceTimersByTime(10)
			bus.emit('variables_changed', new Set(['internal:v']), null)
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Once the window elapses, exactly one trailing execution runs for the whole burst
			vi.advanceTimersByTime(50)
			expect(executeActions).toHaveBeenCalledTimes(2)
		})

		test('flags rate-limited during a burst and clears it once firing stops', () => {
			const { bus, variables, setRateLimited } = createVariables()
			variables.setEnabled(true)
			variables.setVariableChanged('a', 'internal:v')

			bus.emit('variables_changed', new Set(['internal:v']), null) // leading edge, not rate limited
			expect(setRateLimited).not.toHaveBeenCalled()

			vi.advanceTimersByTime(10)
			bus.emit('variables_changed', new Set(['internal:v']), null) // throttled
			expect(setRateLimited).toHaveBeenCalledWith(true)

			// After the burst stops, the flag is cleared (trailing exec at +50ms, clear timer at +1000ms)
			vi.advanceTimersByTime(1100)
			expect(setRateLimited).toHaveBeenLastCalledWith(false)
		})

		test('destroy cancels the pending trailing execution and clears the rate-limited flag', () => {
			const { bus, variables, executeActions, setRateLimited } = createVariables()
			variables.setEnabled(true)
			variables.setVariableChanged('a', 'internal:v')

			bus.emit('variables_changed', new Set(['internal:v']), null) // leading edge
			vi.advanceTimersByTime(10)
			bus.emit('variables_changed', new Set(['internal:v']), null) // throttled -> rate limited, trailing scheduled
			setRateLimited.mockClear()

			variables.destroy()
			expect(setRateLimited).toHaveBeenCalledWith(false)

			// The pending trailing execution must not fire after destroy
			vi.advanceTimersByTime(1100)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('a fresh change after the window fires immediately again', () => {
			const { bus, variables, executeActions } = createVariables()
			variables.setEnabled(true)
			variables.setVariableChanged('a', 'internal:v')

			bus.emit('variables_changed', new Set(['internal:v']), null)
			expect(executeActions).toHaveBeenCalledTimes(1)

			// Well past the throttle window with no pending trailing timer -> another leading edge
			vi.advanceTimersByTime(100)
			bus.emit('variables_changed', new Set(['internal:v']), null)
			expect(executeActions).toHaveBeenCalledTimes(2)
		})
	})

	test('getVariablesChangedDescription', () => {
		const { variables } = createVariables()
		const event: EventInstance = {
			id: 'e1',
			type: 'variable_changed',
			enabled: true,
			options: { variableId: 'internal:a' },
		}
		expect(variables.getVariablesChangedDescription(event)).toBe('When <strong>$(internal:a)</strong> changes')
	})
})

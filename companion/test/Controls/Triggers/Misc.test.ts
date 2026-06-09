import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TriggersEventMisc } from '../../../lib/Controls/ControlTypes/Triggers/Events/Misc.js'
import { TriggerExecutionSource } from '../../../lib/Controls/ControlTypes/Triggers/TriggerExecutionSource.js'
import { MockTriggerEventBus } from './Helpers.js'

function createMisc() {
	const bus = new MockTriggerEventBus()
	const executeActions = vi.fn()
	const misc = new TriggersEventMisc(bus.asTriggerEvents(), 'trigger:test', executeActions)
	return { bus, misc, executeActions }
}

describe('TriggersEventMisc', () => {
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

	describe('startup events', () => {
		test('fires after the configured delay', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setStartup('a', 500)

			const emitTime = Date.now()
			bus.emit('startup')

			vi.advanceTimersByTime(499)
			expect(executeActions).not.toHaveBeenCalled()

			vi.advanceTimersByTime(1)
			expect(executeActions).toHaveBeenCalledTimes(1)
			// nowTime is captured when the event fires, not when the delay elapses
			expect(executeActions).toHaveBeenCalledWith(emitTime, TriggerExecutionSource.Other)
		})

		test('each registered event fires', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setStartup('a', 0)
			misc.setStartup('b', 100)

			bus.emit('startup')
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(2)
		})

		test('does not fire when disabled', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setStartup('a', 0)

			bus.emit('startup')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('clearStartup stops the event', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setStartup('a', 0)
			misc.clearStartup('a')

			bus.emit('startup')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('client connect events', () => {
		test('fires after the configured delay', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setClientConnect('a', 250)

			bus.emit('client_connect')
			vi.advanceTimersByTime(249)
			expect(executeActions).not.toHaveBeenCalled()
			vi.advanceTimersByTime(1)
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('clearClientConnect stops the event', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setClientConnect('a', 0)
			misc.clearClientConnect('a')

			bus.emit('client_connect')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('control press events', () => {
		test('fires on press when listening for presses', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', true)

			bus.emit('control_press', 'bank:other', true, 'surface01')
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
			expect(executeActions).toHaveBeenCalledWith(Date.now(), TriggerExecutionSource.Other)

			// A release does not match
			bus.emit('control_press', 'bank:other', false, 'surface01')
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('fires on release when listening for releases', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', false)

			bus.emit('control_press', 'bank:other', false, 'surface01')
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('presses originating from a trigger are ignored', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', true)

			bus.emit('control_press', 'bank:other', true, 'trigger:some-other-trigger')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('presses with no surface id execute', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', true)

			bus.emit('control_press', 'bank:other', true, undefined)
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('matching press events execute the actions once', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', true)
			misc.setControlPress('b', true)

			bus.emit('control_press', 'bank:other', true, 'surface01')
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('does not fire when disabled', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setControlPress('a', true)

			bus.emit('control_press', 'bank:other', true, 'surface01')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})

		test('clearControlPress stops the event', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setControlPress('a', true)
			misc.clearControlPress('a')

			bus.emit('control_press', 'bank:other', true, 'surface01')
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	describe('computer lock events', () => {
		test('locked listener fires only on locking', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setComputerLocked('a', true)

			bus.emit('locked', false)
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()

			bus.emit('locked', true)
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('unlocked listener fires only on unlocking', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setComputerLocked('a', false)

			bus.emit('locked', true)
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()

			bus.emit('locked', false)
			vi.runAllTimers()
			expect(executeActions).toHaveBeenCalledTimes(1)
		})

		test('clearComputerLocked stops the event', () => {
			const { bus, misc, executeActions } = createMisc()
			misc.setEnabled(true)
			misc.setComputerLocked('a', true)
			misc.clearComputerLocked('a')

			bus.emit('locked', true)
			vi.runAllTimers()
			expect(executeActions).not.toHaveBeenCalled()
		})
	})

	test('destroy detaches from the event bus', () => {
		const { bus, misc, executeActions } = createMisc()
		misc.setEnabled(true)
		misc.setStartup('a', 0)
		misc.setControlPress('b', true)
		misc.setComputerLocked('c', true)
		misc.setClientConnect('d', 0)

		misc.destroy()

		bus.emit('startup')
		bus.emit('client_connect')
		bus.emit('control_press', 'bank:other', true, undefined)
		bus.emit('locked', true)
		vi.runAllTimers()
		expect(executeActions).not.toHaveBeenCalled()
	})
})

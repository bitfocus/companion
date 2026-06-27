import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TriggerEvents } from '../../lib/Controls/TriggerEvents.js'

describe('TriggerEvents', () => {
	// Note: the tick seconds are derived from performance.now(), which is imported
	// from node:perf_hooks and cannot be faked, so only the wall-time values and
	// tick cadence can be asserted exactly.
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
		})
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('emits a tick every second', () => {
		const events = new TriggerEvents()
		const listener = vi.fn()
		events.on('tick', listener)

		vi.advanceTimersByTime(999)
		expect(listener).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(listener).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(3000)
		expect(listener).toHaveBeenCalledTimes(4)

		// The milliseconds value is the wall time of the tick
		const [tickSeconds, nowMs] = listener.mock.calls[3]
		expect(nowMs).toBe(Date.now())

		// The seconds value is what getLastTickTime reports
		expect(events.getLastTickTime()).toBe(tickSeconds)
		expect(typeof tickSeconds).toBe('number')
	})

	test('a throwing listener does not stop the clock', () => {
		const events = new TriggerEvents()
		const listener = vi.fn()
		events.on('tick', listener)
		events.on('tick', () => {
			throw new Error('boom')
		})

		expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
		expect(listener).toHaveBeenCalledTimes(2)
	})
})

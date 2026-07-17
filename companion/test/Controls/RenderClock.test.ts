import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RenderClock } from '../../lib/Controls/RenderClock.js'

describe('RenderClock', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('invokes a subscribed listener once per 100ms tick', () => {
		const clock = new RenderClock()
		const listener = vi.fn()
		clock.subscribe(listener)

		vi.advanceTimersByTime(100)
		expect(listener).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(300)
		expect(listener).toHaveBeenCalledTimes(4)

		clock.destroy()
	})

	test('does not fire before a full tick has elapsed', () => {
		const clock = new RenderClock()
		const listener = vi.fn()
		clock.subscribe(listener)

		vi.advanceTimersByTime(99)
		expect(listener).not.toHaveBeenCalled()

		clock.destroy()
	})

	test('unsubscribe stops further invocations', () => {
		const clock = new RenderClock()
		const listener = vi.fn()
		const unsubscribe = clock.subscribe(listener)

		vi.advanceTimersByTime(100)
		expect(listener).toHaveBeenCalledTimes(1)

		unsubscribe()
		vi.advanceTimersByTime(300)
		expect(listener).toHaveBeenCalledTimes(1)

		clock.destroy()
	})

	test('fires every subscribed listener on a tick', () => {
		const clock = new RenderClock()
		const a = vi.fn()
		const b = vi.fn()
		clock.subscribe(a)
		clock.subscribe(b)

		vi.advanceTimersByTime(100)
		expect(a).toHaveBeenCalledTimes(1)
		expect(b).toHaveBeenCalledTimes(1)

		clock.destroy()
	})

	test('a listener that throws does not prevent other listeners from firing', () => {
		const clock = new RenderClock()
		const throwing = vi.fn(() => {
			throw new Error('boom')
		})
		const other = vi.fn()
		clock.subscribe(throwing)
		clock.subscribe(other)

		expect(() => vi.advanceTimersByTime(100)).not.toThrow()
		expect(throwing).toHaveBeenCalledTimes(1)
		expect(other).toHaveBeenCalledTimes(1)

		// And the throwing listener does not break subsequent ticks
		vi.advanceTimersByTime(100)
		expect(other).toHaveBeenCalledTimes(2)

		clock.destroy()
	})

	test('subscribing the same function reference twice registers it once', () => {
		const clock = new RenderClock()
		const listener = vi.fn()
		clock.subscribe(listener)
		clock.subscribe(listener)

		vi.advanceTimersByTime(100)
		expect(listener).toHaveBeenCalledTimes(1)

		clock.destroy()
	})

	test('destroy stops all ticks and is idempotent', () => {
		const clock = new RenderClock()
		const listener = vi.fn()
		clock.subscribe(listener)

		clock.destroy()
		vi.advanceTimersByTime(1000)
		expect(listener).not.toHaveBeenCalled()

		// A second destroy must not throw
		expect(() => clock.destroy()).not.toThrow()
	})
})

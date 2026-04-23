import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PromiseDebounce } from '../PromiseDebounce.js'

describe('PromiseDebounce', () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
		})
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('basic debouncing', () => {
		it('executes the function after the wait period', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			expect(fn).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('does not execute before the wait period', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			await vi.advanceTimersByTimeAsync(99)
			expect(fn).not.toHaveBeenCalled()
		})

		it('resets the timer on subsequent triggers', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			await vi.advanceTimersByTimeAsync(80)
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(80)
			expect(fn).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(20)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('only calls the function once for multiple rapid triggers', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			debounced.trigger()
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(100)

			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('uses the args from the last trigger before execution', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger('first')
			debounced.trigger('second')
			debounced.trigger('third')
			await vi.advanceTimersByTimeAsync(100)

			expect(fn).toHaveBeenCalledWith('third')
		})
	})

	describe('call() returning results', () => {
		it('resolves with the function return value', async () => {
			const fn = vi.fn().mockResolvedValue('hello')
			const debounced = new PromiseDebounce(fn, 100)

			const promise = debounced.call()
			await vi.advanceTimersByTimeAsync(100)

			await expect(promise).resolves.toBe('hello')
		})

		it('multiple callers all receive the same result', async () => {
			const fn = vi.fn().mockResolvedValue(42)
			const debounced = new PromiseDebounce(fn, 100)

			const p1 = debounced.call()
			const p2 = debounced.call()
			const p3 = debounced.call()
			await vi.advanceTimersByTimeAsync(100)

			await expect(p1).resolves.toBe(42)
			await expect(p2).resolves.toBe(42)
			await expect(p3).resolves.toBe(42)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('rejects all callers when the function throws', async () => {
			const error = new Error('boom')
			const fn = vi.fn().mockRejectedValue(error)
			const debounced = new PromiseDebounce(fn, 100)

			const p1 = debounced.call()
			const p2 = debounced.call()

			// Attach rejection handlers before advancing timers to avoid unhandled rejections
			const a1 = expect(p1).rejects.toThrow('boom')
			const a2 = expect(p2).rejects.toThrow('boom')
			await vi.advanceTimersByTimeAsync(100)
			await a1
			await a2
		})

		it('call() with args passes them to the function', async () => {
			const fn = vi.fn(async (a: number, b: number) => a + b)
			const debounced = new PromiseDebounce(fn, 100)

			const promise = debounced.call(3, 4)
			await vi.advanceTimersByTimeAsync(100)

			await expect(promise).resolves.toBe(7)
		})
	})

	describe('sequential execution', () => {
		it('queues a second execution if one is in progress', async () => {
			const { promise: firstRunPromise, resolve: resolveFirst } = Promise.withResolvers<string>()
			const fn = vi.fn(async () => {
				if (fn.mock.calls.length === 1) {
					return firstRunPromise
				}
				return 'second-result'
			})

			const debounced = new PromiseDebounce(fn, 100)

			// Start first execution
			const p1 = debounced.call()
			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(1)

			// Trigger while first is running — schedules a new debounce timer
			debounced.trigger()
			// Timer fires but executeFn sees isExecuting=true, sets pendingArgs
			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(1) // still 1, first still running

			// Complete first execution; finally block schedules pending via setTimeout(0)
			resolveFirst('first-result')
			await vi.runAllTimersAsync()

			expect(fn).toHaveBeenCalledTimes(2)
			await expect(p1).resolves.toBe('first-result')
		})

		it('executes pending args after first execution finishes', async () => {
			const { promise: firstRunPromise, resolve: resolve1 } = Promise.withResolvers<string>()
			const fn = vi.fn(async (...args: string[]) => {
				if (fn.mock.calls.length === 1) {
					return firstRunPromise
				}
				return args[0]
			})

			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger('run1')
			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(1)

			// Queue up a second while first is still running
			debounced.trigger('run2')

			// Finish first
			resolve1('done1')
			await vi.runAllTimersAsync()

			expect(fn).toHaveBeenCalledTimes(2)
			expect(fn).toHaveBeenLastCalledWith('run2')
		})
	})

	describe('cancelWaiting()', () => {
		it('cancels a pending timeout so fn is never called', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			debounced.cancelWaiting()

			await vi.advanceTimersByTimeAsync(200)
			expect(fn).not.toHaveBeenCalled()
		})

		it('rejects waiting call() promises with a default error', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			const promise = debounced.call()
			debounced.cancelWaiting()

			// Attach rejection handler before advancing timers to avoid unhandled rejection
			const assertion = expect(promise).rejects.toThrow('Cancelled')
			await vi.runAllTimersAsync()
			await assertion
		})

		it('rejects waiting promises with a custom error', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			const promise = debounced.call()
			debounced.cancelWaiting(new Error('custom cancel'))

			const assertion = expect(promise).rejects.toThrow('custom cancel')
			await vi.runAllTimersAsync()
			await assertion
		})

		it('rejects all waiting call() promises on cancel', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			const p1 = debounced.call()
			const p2 = debounced.call()
			debounced.cancelWaiting()

			const a1 = expect(p1).rejects.toThrow('Cancelled')
			const a2 = expect(p2).rejects.toThrow('Cancelled')
			await vi.runAllTimersAsync()
			await a1
			await a2
		})

		it('does nothing when there is nothing pending', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			expect(() => debounced.cancelWaiting()).not.toThrow()
		})

		it('can trigger again after cancellation', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100)

			debounced.trigger()
			debounced.cancelWaiting()

			debounced.trigger()
			await vi.advanceTimersByTimeAsync(100)

			expect(fn).toHaveBeenCalledTimes(1)
		})
	})

	describe('maxWait', () => {
		it('fires at maxWait even if being continually retriggered', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100, 250)

			// Keep triggering every 80ms — would never fire without maxWait
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(80)
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(80)
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(80)
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(40) // total: 280ms > maxWait 250

			expect(fn).toHaveBeenCalled()
		})

		it('fires at the wait period if maxWait is not reached', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100, 500)

			debounced.trigger()
			await vi.advanceTimersByTimeAsync(100)

			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('resets maxWait after an execution', async () => {
			const fn = vi.fn().mockResolvedValue('result')
			const debounced = new PromiseDebounce(fn, 100, 250)

			// First batch: fires at wait (100ms)
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(1)

			// Second batch: also fires at wait (100ms) since timer reset
			debounced.trigger()
			await vi.advanceTimersByTimeAsync(100)
			expect(fn).toHaveBeenCalledTimes(2)
		})
	})

	describe('type safety with args', () => {
		it('passes multiple typed args correctly', async () => {
			const fn = vi.fn(async (x: number, y: string, z: boolean) => `${x}-${y}-${z}`)
			const debounced = new PromiseDebounce(fn, 50)

			const result = debounced.call(1, 'hello', true)
			await vi.advanceTimersByTimeAsync(50)

			await expect(result).resolves.toBe('1-hello-true')
		})

		it('works with no args', async () => {
			const fn = vi.fn(async () => 'no-args')
			const debounced = new PromiseDebounce(fn, 50)

			const result = debounced.call()
			await vi.advanceTimersByTimeAsync(50)

			await expect(result).resolves.toBe('no-args')
		})
	})
})

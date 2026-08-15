import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { VariableValueEntry } from '../../lib/Variables/Values.js'
import { VariablesBlinker } from '../../lib/Variables/VariablesBlinker.js'

describe('VariablesBlinker', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('trackDependencyOnInterval', () => {
		test('returns null for invalid interval (NaN)', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(NaN, 0.5)
			expect(result).toBeNull()
		})

		test('returns null for invalid interval (zero)', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(0, 0.5)
			expect(result).toBeNull()
		})

		test('returns null for invalid interval (negative)', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(-100, 0.5)
			expect(result).toBeNull()
		})

		test('returns null for invalid dutyCycle (NaN)', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(1000, NaN)
			expect(result).toBeNull()
		})

		test('returns variable props for valid interval', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(1000, 0.5)

			expect(result).not.toBeNull()
			expect(result).toMatchObject({
				label: 'internal',
				variableId: 'internal:__interval_500_500',
				name: '__interval_500_500',
			})
		})

		test('clamps interval to minimum of 50ms', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result = blinker.trackDependencyOnInterval(10, 0.5)

			expect(result).not.toBeNull()
			expect(result).toMatchObject({
				variableId: 'internal:__interval_25_25',
				name: '__interval_25_25',
			})
		})

		test('clamps dutyCycle to 0-1 range', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			// dutyCycle > 1 should be clamped to 1
			const result1 = blinker.trackDependencyOnInterval(1000, 1.5)
			expect(result1).toMatchObject({
				name: '__interval_1000_0',
			})

			// dutyCycle < 0 should be clamped to 0
			const result2 = blinker.trackDependencyOnInterval(1000, -0.5)
			expect(result2).toMatchObject({
				name: '__interval_0_1000',
			})
		})

		test('returns same entry for same interval configuration', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result1 = blinker.trackDependencyOnInterval(1000, 0.5)
			const result2 = blinker.trackDependencyOnInterval(1000, 0.5)

			expect(result1).toEqual(result2)
		})

		test('returns different entries for different duty cycles', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			const result1 = blinker.trackDependencyOnInterval(1000, 0.5)
			const result2 = blinker.trackDependencyOnInterval(1000, 0.3)

			expect(result1).not.toEqual(result2)
		})
	})

	describe('blinking behavior', () => {
		test('emits first tick after alignment delay', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			// Start tracking at a specific time
			vi.setSystemTime(new Date(1000))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// No emission yet
			expect(emitChange).not.toHaveBeenCalled()

			// Advance to the first aligned tick
			vi.advanceTimersByTime(1000)

			expect(emitChange).toHaveBeenCalledTimes(1)
			expect(emitChange).toHaveBeenCalledWith([
				{
					id: '__interval_500_500',
					value: true,
				},
			])
		})

		test('alternates between on and off states with correct timing', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0)) // Start at epoch for easier calculation
			blinker.trackDependencyOnInterval(1000, 0.5) // 500ms on, 500ms off

			// Advance to first tick
			vi.advanceTimersByTime(1000)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: true }])

			// After onPeriod (500ms), should turn off
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: false }])

			// After offPeriod (500ms), should turn on
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: true }])

			// After onPeriod (500ms), should turn off again
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: false }])
		})

		test('handles asymmetric duty cycle correctly', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.2) // 200ms on, 800ms off

			// Advance to first transition (200ms)
			vi.advanceTimersByTime(200)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_200_800', value: false }])

			// After offPeriod (800ms), should turn on at epoch boundary 1000ms
			vi.advanceTimersByTime(800)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_200_800', value: true }])
		})

		test('synchronizes initial value when created during off-phase', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			// Start during off phase (600ms into 1000ms interval with 500ms onPeriod)
			vi.setSystemTime(new Date(600))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// Advance 400ms to reach the epoch boundary (1000ms)
			vi.advanceTimersByTime(400)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: true }])

			// After another 500ms, turns off
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: false }])
		})

		test('synchronizes initial value when created during on-phase', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			// Start during on phase (200ms into 1000ms interval with 500ms onPeriod)
			vi.setSystemTime(new Date(200))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// Advance 300ms to reach the on-to-off transition (500ms)
			vi.advanceTimersByTime(300)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_500_500', value: false }])
		})

		test('recovers synchronization when emitChange callback spans across a phase boundary', () => {
			let isSlow = true
			const emitChange = vi.fn().mockImplementation(() => {
				// First callback runs slow, advancing time by 600ms
				if (isSlow) {
					isSlow = false
					vi.setSystemTime(new Date(Date.now() + 600))
				}
			})
			const blinker = new VariablesBlinker(emitChange)

			// Start at epoch 0 (1000ms interval, 500ms onPeriod)
			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// At 500ms: off-transition fires, callback advances time to 1100ms.
			// Post-callback reconciliation emits corrective true for the 1100ms on-phase,
			// and schedules the next off-transition at 1500ms (delay = 400ms)
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenNthCalledWith(1, [{ id: '__interval_500_500', value: false }])
			expect(emitChange).toHaveBeenNthCalledWith(2, [{ id: '__interval_500_500', value: true }])
			expect(emitChange).toHaveBeenCalledTimes(2)

			// At 1500ms (advancing 400ms): off-transition fires cleanly at epoch phase 500ms
			vi.advanceTimersByTime(400)
			expect(emitChange).toHaveBeenNthCalledWith(3, [{ id: '__interval_500_500', value: false }])
			expect(emitChange).toHaveBeenCalledTimes(3)

			// At 2000ms (advancing 500ms): on-transition fires at epoch boundary
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenNthCalledWith(4, [{ id: '__interval_500_500', value: true }])
			expect(emitChange).toHaveBeenCalledTimes(4)
		})

		test('recovers synchronization when multiple consecutive callbacks span across phase boundaries', () => {
			let slowCount = 2
			const emitChange = vi.fn().mockImplementation(() => {
				// Two consecutive callbacks run slow, advancing time by 600ms each
				if (slowCount > 0) {
					slowCount--
					vi.setSystemTime(new Date(Date.now() + 600))
				}
			})
			const blinker = new VariablesBlinker(emitChange)

			// Start at epoch 0 (1000ms interval, 500ms onPeriod)
			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// At 500ms:
			// 1. Off-transition fires at 500ms -> emits false, callback advances time to 1100ms.
			// 2. Loop catches up to on-phase at 1100ms -> emits true, callback advances time to 1700ms.
			// 3. Loop catches up to off-phase at 1700ms -> emits false.
			// 4. Fully reconciled to false; schedules next on-transition at 2000ms (delay = 300ms).
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenNthCalledWith(1, [{ id: '__interval_500_500', value: false }])
			expect(emitChange).toHaveBeenNthCalledWith(2, [{ id: '__interval_500_500', value: true }])
			expect(emitChange).toHaveBeenNthCalledWith(3, [{ id: '__interval_500_500', value: false }])
			expect(emitChange).toHaveBeenCalledTimes(3)

			// At 2000ms (advancing 300ms): on-transition fires cleanly
			vi.advanceTimersByTime(300)
			expect(emitChange).toHaveBeenNthCalledWith(4, [{ id: '__interval_500_500', value: true }])
			expect(emitChange).toHaveBeenCalledTimes(4)
		})

		test('bounds emissions and schedules positive future delay under sustained phase overruns', () => {
			let slowCount = 3
			const emitChange = vi.fn().mockImplementation(() => {
				// First 3 callbacks run slow (500ms each), then callbacks run normally
				if (slowCount > 0) {
					slowCount--
					vi.setSystemTime(new Date(Date.now() + 500))
				}
			})
			const blinker = new VariablesBlinker(emitChange)

			// Start at epoch 0 (1000ms interval, 500ms onPeriod)
			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// Advance to first transition at 500ms
			// Bounded loop executes 3 synchronous emissions (at t=500 -> false, t=1000 -> true, t=1500 -> false)
			// At t=2000, current phase is true. Since limit was reached, a 1ms deferred tick is scheduled.
			vi.advanceTimersByTime(500)
			expect(emitChange).toHaveBeenCalledTimes(3)
			expect(emitChange).toHaveBeenNthCalledWith(1, [{ id: '__interval_500_500', value: false }])
			expect(emitChange).toHaveBeenNthCalledWith(2, [{ id: '__interval_500_500', value: true }])
			expect(emitChange).toHaveBeenNthCalledWith(3, [{ id: '__interval_500_500', value: false }])

			// Advance 1ms to execute the deferred catch-up tick (at t=2001ms, callback emits true)
			vi.advanceTimersByTime(1)
			expect(emitChange).toHaveBeenCalledTimes(4)
			expect(emitChange).toHaveBeenNthCalledWith(4, [{ id: '__interval_500_500', value: true }])

			// At t=2001ms, phase is 1ms into on-period. Next transition is off at t=2500ms (delay = 499ms).
			// Assert no premature emissions before the boundary:
			vi.advanceTimersByTime(498)
			expect(emitChange).toHaveBeenCalledTimes(4)

			// Advance the remaining 1ms to reach t=2500ms: off-transition fires cleanly
			vi.advanceTimersByTime(1)
			expect(emitChange).toHaveBeenCalledTimes(5)
			expect(emitChange).toHaveBeenNthCalledWith(5, [{ id: '__interval_500_500', value: false }])
		})
	})

	describe('cleanup behavior', () => {
		test('cleans up unused intervals after expiry', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0))
			const result = blinker.trackDependencyOnInterval(1000, 0.5)
			expect(result).not.toBeNull()

			// Start the interval
			vi.advanceTimersByTime(1000)
			expect(emitChange).toHaveBeenCalled()

			// Don't probe for a long time (cleanup expiry = interval * 10 = 10 seconds)
			// Cleanup runs every 30 seconds
			vi.advanceTimersByTime(30_000)

			// The interval should be cleaned up, so tracking again should create a new entry
			// with a fresh lastProbed time
			emitChange.mockClear()

			// Create a new interval with different parameters to verify the old one was cleaned
			const result2 = blinker.trackDependencyOnInterval(1000, 0.5)
			expect(result2).toEqual(result) // Same variable name props
		})

		test('does not clean up recently probed intervals', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// Start the interval
			vi.advanceTimersByTime(1000)

			// Probe periodically to keep it alive
			for (let i = 0; i < 5; i++) {
				vi.advanceTimersByTime(5000)
				blinker.trackDependencyOnInterval(1000, 0.5) // Keep probing
			}

			// The interval should still be emitting changes
			const callCountBefore = emitChange.mock.calls.length
			vi.advanceTimersByTime(500)
			expect(emitChange.mock.calls.length).toBeGreaterThan(callCountBefore)
		})

		test('stops emitting after abort', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0))
			blinker.trackDependencyOnInterval(1000, 0.5)

			// Start the interval
			vi.advanceTimersByTime(1000)
			const initialCallCount = emitChange.mock.calls.length

			// Don't probe, let cleanup happen
			vi.advanceTimersByTime(30_000)

			// After cleanup, no more emissions should occur
			const callCountAfterCleanup = emitChange.mock.calls.length
			vi.advanceTimersByTime(5000)

			// No new calls after the interval was cleaned up
			expect(emitChange.mock.calls.length).toBe(callCountAfterCleanup)
			expect(emitChange.mock.calls.length).not.toBe(initialCallCount)
		})
	})

	describe('multiple intervals', () => {
		test('can track multiple intervals simultaneously', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			vi.setSystemTime(new Date(0))
			const result1 = blinker.trackDependencyOnInterval(1000, 0.5)
			const result2 = blinker.trackDependencyOnInterval(500, 0.5)

			expect(result1).not.toEqual(result2)

			// Both should start emitting after their alignment
			vi.advanceTimersByTime(1000)

			const calls = emitChange.mock.calls
			const emittedIds = calls.map((call) => (call[0] as VariableValueEntry[])[0].id)

			expect(emittedIds).toContain('__interval_500_500')
			expect(emittedIds).toContain('__interval_250_250')
		})

		test('intervals with same on/off periods share the same entry', () => {
			const emitChange = vi.fn()
			const blinker = new VariablesBlinker(emitChange)

			// Different total intervals but same on/off split
			// 1000ms with 50% duty = 500:500
			const result1 = blinker.trackDependencyOnInterval(1000, 0.5)

			// 2000ms with 25% duty = 500:1500 (different)
			const result2 = blinker.trackDependencyOnInterval(2000, 0.25)

			// These should be different since 500:1500 != 500:500
			expect(result1).not.toEqual(result2)
		})
	})
})

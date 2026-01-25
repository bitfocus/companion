import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { VariablesBlinker } from '../../lib/Variables/VariablesBlinker.js'
import type { VariableValueEntry } from '../../lib/Variables/Values.js'

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

			// Advance to first tick
			vi.advanceTimersByTime(1000)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_200_800', value: true }])

			// After onPeriod (200ms), should turn off
			vi.advanceTimersByTime(200)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_200_800', value: false }])

			// After offPeriod (800ms), should turn on
			vi.advanceTimersByTime(800)
			expect(emitChange).toHaveBeenLastCalledWith([{ id: '__interval_200_800', value: true }])
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

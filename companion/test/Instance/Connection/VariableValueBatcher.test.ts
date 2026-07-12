import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VariableValueBatcher } from '../../../lib/Instance/Connection/VariableValueBatcher.js'

interface Entry {
	id: string
	value: string
}

describe('VariableValueBatcher', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	test('commits the first update synchronously (leading edge)', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		batcher.add([{ id: 'a', value: '1' }])

		expect(commit).toHaveBeenCalledTimes(1)
		expect(commit).toHaveBeenLastCalledWith([{ id: 'a', value: '1' }])
	})

	test('coalesces a burst latest-wins within the throttle window', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		// First add flushes immediately via the leading edge
		batcher.add([{ id: 'a', value: '1' }])
		expect(commit).toHaveBeenCalledTimes(1)

		// Rapid follow-up updates within the window are buffered, latest value per id wins
		batcher.add([{ id: 'a', value: '2' }])
		batcher.add([{ id: 'b', value: 'x' }])
		batcher.add([{ id: 'a', value: '3' }])
		expect(commit).toHaveBeenCalledTimes(1)

		// Trailing edge flushes once with the merged latest values
		vi.advanceTimersByTime(20)
		expect(commit).toHaveBeenCalledTimes(2)
		expect(commit).toHaveBeenLastCalledWith([
			{ id: 'a', value: '3' },
			{ id: 'b', value: 'x' },
		])
	})

	test('caps commit rate under a continuous flood', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		// Simulate a 1kHz producer for 100ms (one tick every 1ms)
		for (let ms = 0; ms < 100; ms++) {
			batcher.add([{ id: 'a', value: String(ms) }])
			vi.advanceTimersByTime(1)
		}

		// A 1kHz producer over 100ms should be paced to roughly one commit per 20ms window (~50Hz):
		// the leading edge fires once at the start, then the self-re-arming trailing edge holds the cap.
		expect(commit.mock.calls.length).toBeLessThanOrEqual(7)
		expect(commit.mock.calls.length).toBeGreaterThan(1)
	})

	test('settles (stops re-arming) once input goes idle', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		batcher.add([{ id: 'a', value: '1' }]) // leading commit
		batcher.add([{ id: 'a', value: '2' }]) // buffered -> one trailing commit
		vi.advanceTimersByTime(20)

		const countAfterFlush = commit.mock.calls.length

		// Producer has stopped. The self-re-arm must not keep firing forever.
		vi.advanceTimersByTime(1000)
		expect(commit.mock.calls.length).toBe(countAfterFlush)
		expect(vi.getTimerCount()).toBe(0)
	})

	test('does not emit an empty trailing commit when nothing is pending', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		batcher.add([{ id: 'a', value: '1' }])
		expect(commit).toHaveBeenCalledTimes(1)

		// No further updates: the trailing edge must be a no-op
		vi.advanceTimersByTime(50)
		expect(commit).toHaveBeenCalledTimes(1)
	})

	test('destroy cancels a pending trailing flush', () => {
		const commit = vi.fn<(values: Entry[]) => void>()
		const batcher = new VariableValueBatcher<Entry>(commit, 20)

		batcher.add([{ id: 'a', value: '1' }])
		batcher.add([{ id: 'a', value: '2' }]) // buffered for the trailing edge
		expect(commit).toHaveBeenCalledTimes(1)

		batcher.destroy()
		vi.advanceTimersByTime(50)
		expect(commit).toHaveBeenCalledTimes(1)
	})
})

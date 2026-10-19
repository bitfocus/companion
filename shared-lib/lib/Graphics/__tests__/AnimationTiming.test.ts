import { describe, expect, test } from 'vitest'
import {
	AnimationFrameSampler,
	clockCycleOfPeriod,
	combineClockCycles,
	countCycleRenders,
	fitAnimationFrames,
	selectFrameIndex,
	shrinkToPixels,
	snapToRenderClock,
} from '../AnimationTiming.js'

/** Run the sampler over some frame delays, giving each frame's start time, or what happened to it */
function sample(
	delaysMs: number[],
	maxDurationMs = 30_000
): { frames: (number | 'skip' | 'stop')[]; durationMs: number } {
	const sampler = new AnimationFrameSampler(maxDurationMs)
	const frames: (number | 'skip' | 'stop')[] = []
	for (const delayMs of delaysMs) {
		const result = sampler.next(delayMs)
		frames.push(result.type === 'keep' ? result.startMs : result.type)
		if (result.type === 'stop') break
	}
	return { frames, durationMs: sampler.durationMs }
}

describe('AnimationFrameSampler', () => {
	test('keeps frames on screen at a tick, starting at that tick', () => {
		expect(sample([50, 120, 230])).toEqual({ frames: [0, 100, 200], durationMs: 400 })
	})

	test('holds slow frames for several ticks', () => {
		expect(sample([300, 300])).toEqual({ frames: [0, 300], durationMs: 600 })
	})

	test('drops frames which are never on screen at a tick', () => {
		expect(sample([50, 30, 120])).toEqual({ frames: [0, 'skip', 100], durationMs: 200 })
	})

	test('drops frames of a fast animation, without changing its speed', () => {
		const { frames, durationMs } = sample(Array(10).fill(40))
		// The frames on screen at 0, 100, 200 and 300ms
		expect(frames).toEqual([0, 'skip', 100, 'skip', 'skip', 200, 'skip', 300, 'skip', 'skip'])
		expect(durationMs).toBe(400)
	})

	test('treats very short delays as 100ms, like browsers', () => {
		expect(sample([0, 10, 0])).toEqual({ frames: [0, 100, 200], durationMs: 300 })
	})

	test('does not drift with fractional delays', () => {
		const { frames, durationMs } = sample(Array(30).fill(1000 / 30))
		expect(frames.filter((frame) => frame !== 'skip')).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
		expect(durationMs).toBe(1000)
	})

	test('rounds the loop up to a whole tick', () => {
		expect(sample([150]).durationMs).toBe(200)
	})

	test('stops at the maximum duration', () => {
		expect(sample([100, 100, 100, 100], 250)).toEqual({ frames: [0, 100, 'stop'], durationMs: 200 })
	})
})

describe('selectFrameIndex', () => {
	const frameStartMs = [0, 100, 300]

	test('picks the frame on screen at a time', () => {
		expect(selectFrameIndex(frameStartMs, 500, 0)).toBe(0)
		expect(selectFrameIndex(frameStartMs, 500, 100)).toBe(1)
		expect(selectFrameIndex(frameStartMs, 500, 200)).toBe(1)
		expect(selectFrameIndex(frameStartMs, 500, 300)).toBe(2)
		expect(selectFrameIndex(frameStartMs, 500, 400)).toBe(2)
	})

	test('loops, timed from the unix epoch', () => {
		expect(selectFrameIndex(frameStartMs, 500, 500)).toBe(0)
		expect(selectFrameIndex(frameStartMs, 500, 1_700_000_000_100)).toBe(1)
	})

	test('picks the first frame of a static image', () => {
		expect(selectFrameIndex([0], 0, 1234)).toBe(0)
	})
})

describe('snapToRenderClock', () => {
	test('rounds to the nearest tick', () => {
		expect(snapToRenderClock(1_000)).toBe(1_000)
		expect(snapToRenderClock(1_049)).toBe(1_000)
		expect(snapToRenderClock(1_051)).toBe(1_100)
	})
})

describe('shrinkToPixels', () => {
	// The same cases as image-rs
	test('fits within the pixel count', () => {
		expect(shrinkToPixels({ width: 64, height: 32 }, { width: 64, height: 32 }, 1000)).toEqual({
			width: 44,
			height: 22,
		})
	})
	test('never grows past the current size', () => {
		expect(shrinkToPixels({ width: 64, height: 32 }, { width: 10, height: 5 }, 1000)).toEqual({ width: 10, height: 5 })
	})
	test('still fits a very wide or tall image once the short side reaches 1', () => {
		expect(shrinkToPixels({ width: 1000, height: 1 }, { width: 1000, height: 1 }, 100)).toEqual({
			width: 100,
			height: 1,
		})
		expect(shrinkToPixels({ width: 1, height: 1000 }, { width: 1, height: 1000 }, 100)).toEqual({
			width: 1,
			height: 100,
		})
	})
	test('never goes below 1x1', () => {
		expect(shrinkToPixels({ width: 64, height: 32 }, { width: 64, height: 32 }, 0)).toEqual({ width: 1, height: 1 })
	})
})

describe('fitAnimationFrames', () => {
	test('keeps the size while the frames fit', () => {
		const size = { width: 64, height: 32 }
		expect(fitAnimationFrames(size, size, 4, 40_000)).toBe(size)
	})

	test('shrinks in steps as frames are added, as image-rs does', () => {
		// 64x32 fits 4 frames. Shrinks to 44x22 at the 5th frame, then to 30x15 at the 11th
		const base = { width: 64, height: 32 }
		const sizes: { width: number; height: number }[] = []
		let current = base
		for (let count = 1; count <= 20; count++) {
			current = fitAnimationFrames(base, current, count, 40_000)
			sizes.push(current)
		}

		expect(sizes[3]).toEqual({ width: 64, height: 32 })
		expect(sizes[4]).toEqual({ width: 44, height: 22 })
		expect(sizes[9]).toEqual({ width: 44, height: 22 })
		expect(sizes[10]).toEqual({ width: 30, height: 15 })
		expect(sizes[19]).toEqual({ width: 30, height: 15 })
		expect(20 * 30 * 15 * 4).toBeLessThanOrEqual(40_000)
	})
})

describe('countCycleRenders', () => {
	test('is 1 with no animations', () => {
		expect(countCycleRenders([])).toBe(1)
	})

	test('is the frame count of a single animation, however slow', () => {
		expect(countCycleRenders([{ frameCount: 4, durationMs: 10_000 }])).toBe(4)
	})

	test('counts the frames of each animation over their combined cycle', () => {
		// They repeat together after 1.2s, in which the first shows 6 frames and the second 2
		expect(
			countCycleRenders([
				{ frameCount: 2, durationMs: 400 },
				{ frameCount: 1, durationMs: 600 },
			])
		).toBe(8)
	})

	test('is at most one per tick of the render clock', () => {
		expect(
			countCycleRenders([
				{ frameCount: 3, durationMs: 300 },
				{ frameCount: 3, durationMs: 300 },
			])
		).toBe(3)
	})

	test('is effectively endless when the loops barely line up', () => {
		const count = countCycleRenders([
			{ frameCount: 299, durationMs: 29_900 },
			{ frameCount: 300, durationMs: 30_000 },
			{ frameCount: 293, durationMs: 29_300 },
			{ frameCount: 283, durationMs: 28_300 },
		])
		expect(count).toBeGreaterThan(1_000_000)
		expect(Number.isSafeInteger(count)).toBe(true)
	})
})

describe('clockCycleOfPeriod', () => {
	test('is the period when it is a whole number of ticks', () => {
		expect(clockCycleOfPeriod(1000)).toBe(1000)
		expect(clockCycleOfPeriod(100)).toBe(100)
	})

	test('is the first whole number of ticks which is also a whole number of periods', () => {
		// Seen every 100ms, a 150ms period shows the same positions again after 300ms
		expect(clockCycleOfPeriod(150)).toBe(300)
		expect(clockCycleOfPeriod(50)).toBe(100)
	})
})

describe('combineClockCycles', () => {
	test('is the time until both repeat together', () => {
		expect(combineClockCycles(1000, 2000)).toBe(2000)
		expect(combineClockCycles(400, 600)).toBe(1200)
	})

	test('treats 0 as never changing', () => {
		expect(combineClockCycles(0, 600)).toBe(600)
		expect(combineClockCycles(600, 0)).toBe(600)
		expect(combineClockCycles(0, 0)).toBe(0)
	})

	test('is capped for loops which barely line up', () => {
		let cycle = 0
		for (const period of [29_900, 30_000, 29_300, 28_300, 27_700]) cycle = combineClockCycles(cycle, period)
		expect(Number.isSafeInteger(cycle)).toBe(true)
		expect(cycle).toBeGreaterThan(1_000_000_000)
	})
})

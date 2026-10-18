import { describe, expect, test } from 'vitest'
import { AnimationFrameSampler, selectFrameIndex, snapToRenderClock } from '../AnimationTiming.js'

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

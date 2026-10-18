/**
 * Timing of animated images, shared by the backend (which decodes animations with image-rs) and the webui (which
 * decodes them in the browser), so that both play an animation the same way.
 */

/** How often buttons are redrawn, and so the finest steps an animation can play in */
export const RENDER_CLOCK_INTERVAL_MS = 100

/** Animations longer than this are cut short, to bound the memory they use */
export const MAX_ANIMATION_DURATION_MS = 30_000

/**
 * Snap a time to the render clock, so that everything drawn in the same tick shows the same moment
 */
export function snapToRenderClock(timeMs: number): number {
	return Math.round(timeMs / RENDER_CLOCK_INTERVAL_MS) * RENDER_CLOCK_INTERVAL_MS
}

/**
 * Choose the frame of an animation to show at a point in time.
 * Every animation is timed from the unix epoch, so that all copies of an animation stay in sync
 * @param frameStartMs When each frame starts being shown, in ms from the start of the animation
 * @param durationMs The length of one loop of the animation
 * @param timeMs The time to show
 */
export function selectFrameIndex(frameStartMs: readonly number[], durationMs: number, timeMs: number): number {
	if (durationMs <= 0) return 0

	const position = timeMs % durationMs
	let frameIndex = 0
	for (let i = 1; i < frameStartMs.length && frameStartMs[i] <= position; i++) {
		frameIndex = i
	}
	return frameIndex
}

export type AnimationFrameSample =
	/** Keep the frame, which starts being shown at this time */
	| { type: 'keep'; startMs: number }
	/** The frame is never on screen at a tick */
	| { type: 'skip' }
	/** The maximum duration has been reached, no more frames are needed */
	| { type: 'stop' }

// Browsers treat very short delays as 100ms, as many GIFs in the wild rely on this
function effectiveDelayMs(delayMs: number): number {
	return delayMs <= 10 ? 100 : delayMs
}

/**
 * Sample-and-hold of the frames of an animation onto the render clock: each tick shows whichever frame is on
 * screen at that moment. Frames of a fast animation which fall between ticks are dropped without changing the
 * timing of the rest, while slow frames are held for several ticks.
 * Every time is rounded up to a tick, so the loop is a whole number of ticks.
 *
 * This must match `FrameSampler` in image-rs, which the backend decodes animations with
 */
export class AnimationFrameSampler {
	readonly #maxTicks: number
	#elapsedMs = 0

	constructor(maxDurationMs: number) {
		this.#maxTicks = Math.max(1, Math.floor(maxDurationMs / RENDER_CLOCK_INTERVAL_MS))
	}

	// The first tick at or after a time. Fractional delays (eg 1/30s) accumulate float error, which must not
	// push an exact tick time over to the next one
	#toTicks(ms: number): number {
		return Math.max(0, Math.ceil(ms / RENDER_CLOCK_INTERVAL_MS - 1e-6))
	}

	/**
	 * Decide what to do with the next frame of the animation
	 * @param delayMs How long the frame is shown for
	 */
	next(delayMs: number): AnimationFrameSample {
		const startTick = this.#toTicks(this.#elapsedMs)
		if (startTick >= this.#maxTicks) return { type: 'stop' }

		this.#elapsedMs += effectiveDelayMs(delayMs)

		if (this.#toTicks(this.#elapsedMs) > startTick) {
			return { type: 'keep', startMs: startTick * RENDER_CLOCK_INTERVAL_MS }
		} else {
			return { type: 'skip' }
		}
	}

	/** The length of one loop of the animation, in ms */
	get durationMs(): number {
		const ticks = Math.min(Math.max(1, this.#toTicks(this.#elapsedMs)), this.#maxTicks)
		return ticks * RENDER_CLOCK_INTERVAL_MS
	}
}

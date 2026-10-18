/**
 * Timing of animated images, shared by the backend (which decodes animations with image-rs) and the webui (which
 * decodes them in the browser), so that both play an animation the same way.
 */

/** How often buttons are redrawn, and so the finest steps an animation can play in */
export const RENDER_CLOCK_INTERVAL_MS = 100

/** Animations longer than this are cut short, to bound the memory they use */
export const MAX_ANIMATION_DURATION_MS = 30_000

/**
 * The most memory the decoded pixels of one image may use (~2900x2900). An animation larger than this has its
 * frames scaled down to fit, while the backend draws a larger static image from its source instead
 */
export const MAX_DECODED_IMAGE_BYTES = 32 * 1024 * 1024

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

export interface FrameSize {
	width: number
	height: number
}

/**
 * Scale a size down, keeping its aspect ratio, to at most this many pixels. Never grows past `current`, or goes
 * below 1x1
 * @param base The size of the frames before any shrinking
 * @param current The size the frames are currently kept at
 */
export function shrinkToPixels(base: FrameSize, current: FrameSize, maxPixels: number): FrameSize {
	const scale = Math.sqrt(maxPixels / (base.width * base.height))
	let width = Math.min(Math.max(Math.floor(base.width * scale), 1), current.width)
	let height = Math.min(Math.max(Math.floor(base.height * scale), 1), current.height)
	// When one side is clamped to 1, the other must give way so the total still fits
	width = Math.min(width, Math.max(Math.floor(maxPixels / height), 1))
	height = Math.min(height, Math.max(Math.floor(maxPixels / width), 1))
	return { width, height }
}

/**
 * The size to keep the frames of an animation at once another frame is added, so that they all fit in `maxBytes`.
 * When the new frame would go over the limit, everything shrinks to fit in half of it, which leaves room for as many
 * frames again before the next shrink. The frames already kept must be rescaled to the returned size.
 *
 * This must match how image-rs applies `maxBytes`, so that a large animation is the same size in both
 * @param base The size of the frames before any shrinking
 * @param current The size the frames are currently kept at
 * @param frameCount The number of frames, including the one being added
 */
export function fitAnimationFrames(
	base: FrameSize,
	current: FrameSize,
	frameCount: number,
	maxBytes: number
): FrameSize {
	if (frameCount * current.width * current.height * 4 <= maxBytes) return current

	return shrinkToPixels(base, current, Math.floor(maxBytes / 2 / 4 / frameCount))
}

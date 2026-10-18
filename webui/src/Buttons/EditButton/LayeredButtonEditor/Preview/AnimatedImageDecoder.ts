import {
	AnimationFrameSampler,
	fitAnimationFrames,
	MAX_ANIMATION_DURATION_MS,
	MAX_DECODED_IMAGE_BYTES,
	type FrameSize,
} from '@companion-app/shared/Graphics/AnimationTiming.js'

/** An animated image, decoded into its frames resampled onto the render clock, to match how the backend plays it */
export interface DecodedAnimation {
	frames: ImageBitmap[]
	/** When each frame starts being shown, in ms from the start of the animation */
	frameStartMs: number[]
	/** The length of one loop of the animation, in ms */
	durationMs: number
}

/** The formats which can be animated */
const ANIMATED_MIME_TYPES = new Set(['image/gif', 'image/png', 'image/apng', 'image/webp'])

function resizeTo(size: FrameSize): ImageBitmapOptions {
	return { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' }
}

/**
 * Decode the frames of an animated image, if it is one.
 * This uses the browser's ImageDecoder; where that is not available, animations are shown as their first frame.
 * Like the backend, the frames are scaled down when together they would be larger than MAX_DECODED_IMAGE_BYTES
 * @param dataUrl The image, as a data url
 * @returns The frames, or null if the image is not animated
 */
export async function decodeAnimatedImage(dataUrl: string): Promise<DecodedAnimation | null> {
	if (typeof ImageDecoder === 'undefined') return null

	const mimeType = /^data:([^;,]+)/.exec(dataUrl)?.[1]?.toLowerCase()
	if (!mimeType || !ANIMATED_MIME_TYPES.has(mimeType) || !(await ImageDecoder.isTypeSupported(mimeType))) return null

	const data = await (await fetch(dataUrl)).arrayBuffer()
	const decoder = new ImageDecoder({ data, type: mimeType })
	const frames: ImageBitmap[] = []
	try {
		await decoder.tracks.ready
		const track = decoder.tracks.selectedTrack
		if (!track?.animated) return null

		// The frame count is only final once the whole image has been read
		await decoder.completed
		if (track.frameCount <= 1) return null

		const sampler = new AnimationFrameSampler(MAX_ANIMATION_DURATION_MS)
		const frameStartMs: number[] = []
		let baseSize: FrameSize | null = null
		let size: FrameSize | null = null
		for (let frameIndex = 0; frameIndex < track.frameCount; frameIndex++) {
			const { image } = await decoder.decode({ frameIndex })
			try {
				// The duration is in microseconds
				const sample = sampler.next((image.duration ?? 0) / 1000)
				if (sample.type === 'stop') break
				if (sample.type === 'skip') continue

				baseSize ??= { width: image.displayWidth, height: image.displayHeight }
				const current = size ?? baseSize
				size = fitAnimationFrames(baseSize, current, frames.length + 1, MAX_DECODED_IMAGE_BYTES)
				if (size.width !== current.width || size.height !== current.height) {
					for (let i = 0; i < frames.length; i++) {
						const previous = frames[i]
						frames[i] = await createImageBitmap(previous, resizeTo(size))
						previous.close()
					}
				}

				frames.push(await createImageBitmap(image, resizeTo(size)))
				frameStartMs.push(sample.startMs)
			} finally {
				image.close()
			}
		}

		return { frames, frameStartMs, durationMs: sampler.durationMs }
	} catch (e) {
		for (const frame of frames) frame.close()
		throw e
	} finally {
		decoder.close()
	}
}

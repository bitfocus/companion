import * as imageRs from '@julusian/image-rs'
import { Canvas } from '@napi-rs/canvas'
import { MAX_ANIMATION_DURATION_MS, RENDER_CLOCK_INTERVAL_MS } from '@companion-app/shared/Graphics/AnimationTiming.js'
import { trimBase64ImageToValid } from '@companion-app/shared/Graphics/ImageBase.js'
import { loadBase64Image } from '../Image.js'

/**
 * The result of decoding an image source string for the image cache
 * - `raster`: the image was decoded into pixels
 * - `passthrough`: the image is not decoded ahead of time, and should be drawn from its source as before.
 *   This is used for vector images (so they stay sharp at any size), and for anything that failed to decode
 *   (so that it is reported in the same way as before)
 */
export type DecodeImageResult =
	| {
			type: 'raster'
			/** Straight alpha RGBA pixels, with each frame stored back to back */
			buffer: SharedArrayBuffer
			width: number
			height: number
			frameCount: number
			/**
			 * When each frame starts being shown, in ms from the start of the animation.
			 * These are all multiples of the render clock interval
			 */
			frameStartMs: number[]
			/** The length of one loop of the animation, in ms. 0 for a static image */
			durationMs: number
	  }
	| { type: 'passthrough' }

/**
 * Whether an image source string is an svg, which should stay a vector
 */
function isSvgImage(trimmedImage: string): boolean {
	if (trimmedImage.startsWith('data:')) {
		const headerEnd = trimmedImage.indexOf(',')
		return trimmedImage.slice(0, headerEnd).toLowerCase().includes('svg')
	}

	// Sniff the start of a bare base64 string for markup, as it has no mime type
	for (const byte of Buffer.from(trimmedImage.slice(0, 64), 'base64')) {
		// Skip whitespace and a utf8 byte order mark
		if (
			byte === 0x20 ||
			byte === 0x09 ||
			byte === 0x0a ||
			byte === 0x0d ||
			byte === 0xef ||
			byte === 0xbb ||
			byte === 0xbf
		)
			continue
		return byte === 0x3c // '<'
	}
	return false
}

/** Enough of the start of an image to find whether it is animated, as base64 characters (~64KB) */
const ANIMATION_SNIFF_LENGTH = 4 * 1024 * 16

/**
 * Whether an image source string is in a format which can be animated, and claims to be.
 * Only the start of the image is decoded to check
 */
function isAnimatedImage(trimmedImage: string): boolean {
	let base64Start = 0
	if (trimmedImage.startsWith('data:')) {
		const headerEnd = trimmedImage.indexOf(',')
		if (!trimmedImage.slice(0, headerEnd).includes(';base64')) return false
		base64Start = headerEnd + 1
	}
	const bytes = Buffer.from(trimmedImage.slice(base64Start, base64Start + ANIMATION_SNIFF_LENGTH), 'base64')

	// GIF: anything could have more frames, so let the decoder find out
	if (bytes.subarray(0, 4).toString('latin1') === 'GIF8') return true

	// WebP: the extended header has a flag for animation
	if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 16).toString('latin1') === 'WEBPVP8X') {
		return bytes.length > 20 && (bytes[20] & 0x02) !== 0
	}

	// PNG: an APNG has an animation control chunk before its image data
	if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
		let offset = 8
		while (offset + 8 <= bytes.length) {
			const chunkType = bytes.subarray(offset + 4, offset + 8).toString('latin1')
			if (chunkType === 'acTL') return true
			if (chunkType === 'IDAT') return false
			offset += 12 + bytes.readUInt32BE(offset)
		}
	}

	return false
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Decode the frames of an animated image, resampled onto the render clock.
 * The frames are stored at the image's own size, unless together they would be larger than maxBytes, in which case
 * they are scaled down just enough to fit. Unlike a static image, an animation can't be drawn from its source instead
 */
async function decodeAnimatedImage(trimmedImage: string, maxBytes: number): Promise<DecodeImageResult> {
	// Data urls are decoded by image-rs, but it needs the bytes of a bare base64 string
	const input = trimmedImage.startsWith('data:') ? trimmedImage : Buffer.from(trimmedImage, 'base64')
	const options: imageRs.DecodeFramesOptions = {
		sampleIntervalMs: RENDER_CLOCK_INTERVAL_MS,
		maxDurationMs: MAX_ANIMATION_DURATION_MS,
	}

	let frames = await imageRs.decodeFrames(input, options)
	if (frames.buffer.byteLength > maxBytes) {
		const scale = Math.sqrt(maxBytes / frames.buffer.byteLength)
		frames = await imageRs.decodeFrames(input, {
			...options,
			maxWidth: Math.max(1, Math.floor(frames.width * scale)),
			maxHeight: Math.max(1, Math.floor(frames.height * scale)),
		})
	}

	const buffer = new SharedArrayBuffer(frames.buffer.byteLength)
	new Uint8Array(buffer).set(frames.buffer)

	return {
		type: 'raster',
		buffer,
		width: frames.width,
		height: frames.height,
		frameCount: frames.frameCount,
		frameStartMs: frames.frameStartMs,
		durationMs: frames.durationMs,
	}
}

/**
 * Decode an image source string into a buffer of pixels, shared with the other render threads.
 * The image is stored at its own size, so that it draws the same as it would from its source at any size.
 * Animated GIF, APNG and WebP images have all of their frames decoded, while anything else is decoded by the canvas,
 * so that it matches how it would be drawn from its source.
 * This is run in a render thread, so that the main thread never handles pixel data.
 * @param source The image, as a data url or a bare base64 string
 * @param maxBytes The largest decoded image to store. Anything larger is left to be drawn from its source
 */
export async function decodeImage(source: string, maxBytes: number): Promise<DecodeImageResult> {
	// Match how the renderer treats a source string
	const trimmedImage = trimBase64ImageToValid(source.trim())
	if (trimmedImage.length <= 40 || isSvgImage(trimmedImage)) return { type: 'passthrough' }

	if (isAnimatedImage(trimmedImage)) {
		try {
			const result = await decodeAnimatedImage(trimmedImage, maxBytes)
			// A single frame is drawn as a static image, so that it matches how it would be drawn from its source
			if (result.type !== 'raster' || result.frameCount > 1) return result
		} catch (_e) {
			// Fall back to decoding a single frame
		}
	}

	let image: Awaited<ReturnType<typeof loadBase64Image>>
	try {
		image = await loadBase64Image(trimmedImage)
	} catch (_e) {
		// Leave it for the renderer to report the failure
		return { type: 'passthrough' }
	}
	const { width, height } = image
	if (width === 0 || height === 0 || width * height * 4 > maxBytes) return { type: 'passthrough' }

	const canvas = new Canvas(width, height)
	const context2d = canvas.getContext('2d')
	context2d.drawImage(image, 0, 0)
	const pixels = context2d.getImageData(0, 0, width, height).data

	const buffer = new SharedArrayBuffer(pixels.byteLength)
	new Uint8Array(buffer).set(pixels)

	return {
		type: 'raster',
		buffer,
		width,
		height,
		frameCount: 1,
		frameStartMs: [0],
		durationMs: 0,
	}
}

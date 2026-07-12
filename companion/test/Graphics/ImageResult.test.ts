import * as imageRs from '@julusian/image-rs'
import { describe, expect, test, vi } from 'vitest'
import { ImageResult, type ImageResultProcessedStyle } from '../../lib/Graphics/ImageResult.js'

/**
 * Build a deterministic rgb test pattern of the given size.
 */
function makeRgbBuffer(width: number, height: number): Uint8Array {
	const buffer = new Uint8Array(width * height * 3)
	for (let i = 0; i < width * height; i++) {
		buffer[i * 3] = (i * 37) % 256
		buffer[i * 3 + 1] = (i * 91) % 256
		buffer[i * 3 + 2] = (i * 13) % 256
	}
	return buffer
}

/**
 * Construct an ImageResult with mockable draw functions, returning the spies for assertions.
 */
function createImage(
	style: ImageResultProcessedStyle | null = null,
	drawNative = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
) {
	const image = new ImageResult(style, drawNative)
	return { image, drawNative }
}

describe('ImageResult', () => {
	describe('constructor and properties', () => {
		test('stores the style', () => {
			const style: ImageResultProcessedStyle = { type: 'button' }
			const { image } = createImage(style)
			expect(image.style).toBe(style)
		})

		test('style can be null', () => {
			const { image } = createImage(null)
			expect(image.style).toBeNull()
		})

		test('updated is set to a timestamp', () => {
			const before = Date.now()
			const { image } = createImage(null)
			expect(typeof image.updated).toBe('number')
			expect(image.updated).toBeGreaterThanOrEqual(before)
		})

		test('drawElements defaults to null', () => {
			const { image } = createImage(null)
			expect(image.drawElements).toBeNull()
		})

		test('drawElements is stored when provided', () => {
			const drawElements: never[] = []
			const image = new ImageResult(null, vi.fn(), drawElements)
			expect(image.drawElements).toBe(drawElements)
		})

		test('referencedLocations defaults to an empty set', () => {
			const { image } = createImage(null)
			expect(image.referencedLocations).toBeInstanceOf(Set)
			expect(image.referencedLocations.size).toBe(0)
		})

		test('referencedLocations is stored when provided', () => {
			const locations = new Set(['1/0/0', '2/1/3'])
			const image = new ImageResult(null, vi.fn(), null, locations)
			expect(image.referencedLocations).toBe(locations)
		})
	})

	describe('bgcolor', () => {
		test('returns the style color when set', () => {
			const { image } = createImage({ type: 'button', color: { color: 0x123456 } })
			expect(image.bgcolor).toBe(0x123456)
		})

		test('returns 0 when the style has no color', () => {
			const { image } = createImage({ type: 'button' })
			expect(image.bgcolor).toBe(0)
		})

		test('returns 0 when the style is null', () => {
			const { image } = createImage(null)
			expect(image.bgcolor).toBe(0)
		})
	})

	describe('drawNative', () => {
		test('passes through to the underlying draw fn and returns its buffer', async () => {
			const buffer = new Uint8Array([9, 8, 7])
			const drawNative = vi.fn().mockResolvedValue(buffer)
			const { image } = createImage(null, drawNative)

			const result = await image.drawNative(72, 48, 90, 'rgba')

			expect(result).toBe(buffer)
			expect(drawNative).toHaveBeenCalledWith(72, 48, 90, 'rgba')
		})

		test('caches by width, height, rotation and format', async () => {
			const drawNative = vi.fn(async (w: number, h: number) => new Uint8Array([w, h]))
			const { image } = createImage(null, drawNative)

			const first = await image.drawNative(8, 8, null, 'rgb')
			const second = await image.drawNative(8, 8, null, 'rgb')

			expect(second).toBe(first)
			expect(drawNative).toHaveBeenCalledTimes(1)
		})

		test('re-renders for a different size', async () => {
			const drawNative = vi.fn(async (w: number, h: number) => new Uint8Array([w, h]))
			const { image } = createImage(null, drawNative)

			await image.drawNative(8, 8, null, 'rgb')
			await image.drawNative(16, 16, null, 'rgb')

			expect(drawNative).toHaveBeenCalledTimes(2)
		})

		test('re-renders for a different format', async () => {
			const drawNative = vi.fn().mockResolvedValue(new Uint8Array([1]))
			const { image } = createImage(null, drawNative)

			await image.drawNative(8, 8, null, 'rgb')
			await image.drawNative(8, 8, null, 'rgba')

			expect(drawNative).toHaveBeenCalledTimes(2)
		})

		test('re-renders for a different rotation, and null differs from 0', async () => {
			const drawNative = vi.fn().mockResolvedValue(new Uint8Array([1]))
			const { image } = createImage(null, drawNative)

			await image.drawNative(8, 8, null, 'rgb')
			await image.drawNative(8, 8, 90, 'rgb')
			await image.drawNative(8, 8, 0, 'rgb')

			expect(drawNative).toHaveBeenCalledTimes(3)
		})

		test('dedupes concurrent calls for the same key', async () => {
			let resolve!: (value: Uint8Array) => void
			const drawNative = vi.fn().mockReturnValue(new Promise<Uint8Array>((r) => (resolve = r)))
			const { image } = createImage(null, drawNative)

			const a = image.drawNative(8, 8, null, 'rgb')
			const b = image.drawNative(8, 8, null, 'rgb')
			resolve(new Uint8Array([5]))

			expect(await a).toBe(await b)
			expect(drawNative).toHaveBeenCalledTimes(1)
		})
	})

	describe('drawNativeEncoded', () => {
		test.each(['png', 'webp'] as const)('%s encoding is a lossless data url', async (format) => {
			const width = 12
			const height = 8
			const raw = makeRgbBuffer(width, height)
			const { image } = createImage(null, vi.fn().mockResolvedValue(raw))

			const dataUrl = await image.drawNativeEncoded(width, height, null, format)

			expect(dataUrl.startsWith(`data:image/${format};base64,`)).toBe(true)

			// Decode it back and confirm it is pixel-identical to the source
			const decoded = await imageRs.ImageTransformer.fromImageDataUrl(dataUrl).toBuffer('rgb')
			expect(Buffer.from(decoded.buffer)).toEqual(Buffer.from(raw))
		})

		test('renders from the rgb pixels and passes rotation through', async () => {
			const drawNative = vi.fn().mockResolvedValue(makeRgbBuffer(8, 8))
			const { image } = createImage(null, drawNative)

			await image.drawNativeEncoded(8, 8, 90, 'png')

			expect(drawNative).toHaveBeenCalledWith(8, 8, 90, 'rgb')
		})

		test('caches the encoded data url per width/height/rotation/format', async () => {
			const drawNative = vi.fn().mockResolvedValue(makeRgbBuffer(8, 8))
			const { image } = createImage(null, drawNative)

			const first = await image.drawNativeEncoded(8, 8, null, 'png')
			const second = await image.drawNativeEncoded(8, 8, null, 'png')

			expect(second).toBe(first)
			// The raw render was produced once and reused for the encode
			expect(drawNative).toHaveBeenCalledTimes(1)
			expect(drawNative).toHaveBeenCalledWith(8, 8, null, 'rgb')
		})

		test('reuses the shared drawNative render across different encoded formats', async () => {
			const drawNative = vi.fn().mockResolvedValue(makeRgbBuffer(8, 8))
			const { image } = createImage(null, drawNative)

			const png = await image.drawNativeEncoded(8, 8, null, 'png')
			const webp = await image.drawNativeEncoded(8, 8, null, 'webp')

			expect(png).not.toBe(webp)
			expect(png.startsWith('data:image/png;base64,')).toBe(true)
			expect(webp.startsWith('data:image/webp;base64,')).toBe(true)
			// Only one rgb render, shared between both encodes via the drawNative cache
			expect(drawNative).toHaveBeenCalledTimes(1)
		})

		test('returns an empty string without encoding when the render is empty', async () => {
			const drawNative = vi.fn().mockResolvedValue(new Uint8Array(0))
			const { image } = createImage(null, drawNative)

			const first = await image.drawNativeEncoded(8, 8, null, 'png')
			const second = await image.drawNativeEncoded(8, 8, null, 'png')

			expect(first).toBe('')
			// The empty result is cached too, so the render is not repeated
			expect(second).toBe('')
			expect(drawNative).toHaveBeenCalledTimes(1)
		})
	})
})

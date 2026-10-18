import { Canvas } from '@napi-rs/canvas'
import { describe, expect, test } from 'vitest'
import { AnimationFrameSampler, MAX_ANIMATION_DURATION_MS } from '@companion-app/shared/Graphics/AnimationTiming.js'
import { decodeImage, type DecodeImageResult } from '../../../lib/Graphics/ImageCache/DecodeImage.js'
import { makeAnimatedGif, makeAnimatedPng, toDataUrl, type FixtureFrame } from './AnimatedImageFixtures.js'

/** Create a PNG data URL, with the left half red and the right half blue */
function makePngDataUrl(width: number, height: number): string {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#ff0000'
	ctx.fillRect(0, 0, width / 2, height)
	ctx.fillStyle = '#0000ff'
	ctx.fillRect(width / 2, 0, width / 2, height)
	return canvas.toDataURL('image/png')
}

const SVG_MARKUP =
	'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>'

const MAX_BYTES = 32 * 1024 * 1024

describe('decodeImage', () => {
	test('decodes a png into rgba pixels in a shared buffer', async () => {
		const result = await decodeImage(makePngDataUrl(8, 4), MAX_BYTES)
		if (result.type !== 'raster') throw new Error('Expected a raster')

		expect(result.width).toBe(8)
		expect(result.height).toBe(4)
		expect(result.frameCount).toBe(1)
		expect(result.buffer).toBeInstanceOf(SharedArrayBuffer)
		expect(result.buffer.byteLength).toBe(8 * 4 * 4)

		const pixels = new Uint8Array(result.buffer)
		// Top left is red, top right is blue
		expect([...pixels.subarray(0, 4)]).toEqual([255, 0, 0, 255])
		expect([...pixels.subarray(7 * 4, 8 * 4)]).toEqual([0, 0, 255, 255])
	})

	test('decodes an image at its own size without altering any pixels', async () => {
		const canvas = new Canvas(48, 32)
		const ctx = canvas.getContext('2d')
		const colors = ['#ff0000', 'rgba(0, 255, 0, 0.5)', 'rgba(0, 0, 255, 0.1)', '#ffff00']
		for (let i = 0; i < 4; i++) {
			ctx.fillStyle = colors[i]
			ctx.fillRect((i % 2) * 24, Math.floor(i / 2) * 16, 24, 16)
		}
		const expectedPixels = ctx.getImageData(0, 0, 48, 32).data

		const result = await decodeImage(canvas.toDataURL('image/png'), MAX_BYTES)
		if (result.type !== 'raster') throw new Error('Expected a raster')
		expect(Buffer.from(result.buffer).equals(Buffer.from(expectedPixels))).toBe(true)
	})

	test('decodes a bare base64 png', async () => {
		const dataUrl = makePngDataUrl(8, 8)
		const result = await decodeImage(dataUrl.slice(dataUrl.indexOf(',') + 1), MAX_BYTES)
		expect(result).toMatchObject({ type: 'raster', width: 8, height: 8 })
	})

	test('keeps a large image at its full size', async () => {
		const result = await decodeImage(makePngDataUrl(600, 300), MAX_BYTES)
		expect(result).toMatchObject({ type: 'raster', width: 600, height: 300 })
	})

	test('passes through an image larger than the byte limit', async () => {
		const dataUrl = makePngDataUrl(64, 64)
		expect(await decodeImage(dataUrl, 64 * 64 * 4)).toMatchObject({ type: 'raster' })
		expect(await decodeImage(dataUrl, 64 * 64 * 4 - 1)).toEqual({ type: 'passthrough' })
	})

	test('passes through an svg data url, so it stays a vector', async () => {
		const result = await decodeImage(
			'data:image/svg+xml;base64,' + Buffer.from(SVG_MARKUP).toString('base64'),
			MAX_BYTES
		)
		expect(result).toEqual({ type: 'passthrough' })
	})

	test('passes through a bare base64 svg', async () => {
		const result = await decodeImage(Buffer.from(SVG_MARKUP).toString('base64'), MAX_BYTES)
		expect(result).toEqual({ type: 'passthrough' })
	})

	test('decodes a data url with surrounding whitespace', async () => {
		const result = await decodeImage('  ' + makePngDataUrl(8, 8) + '\n', MAX_BYTES)
		expect(result).toMatchObject({ type: 'raster', width: 8, height: 8 })
	})

	test('passes through a percent-encoded svg', async () => {
		const result = await decodeImage('data:image/svg+xml,' + encodeURIComponent(SVG_MARKUP), MAX_BYTES)
		expect(result).toEqual({ type: 'passthrough' })
	})

	test('passes through a string too short to be an image', async () => {
		expect(await decodeImage('data:image/png;base64,AAAA', MAX_BYTES)).toEqual({ type: 'passthrough' })
	})

	test('passes through a string which is not an image', async () => {
		const result = await decodeImage('this is definitely not an image, it is just some text!!', MAX_BYTES)
		expect(result).toEqual({ type: 'passthrough' })
	})

	test('passes through data which fails to decode', async () => {
		const result = await decodeImage(
			'data:image/png;base64,' + Buffer.from('z'.repeat(100)).toString('base64'),
			MAX_BYTES
		)
		expect(result).toEqual({ type: 'passthrough' })
	})
})

const RED: [number, number, number] = [255, 0, 0]
const GREEN: [number, number, number] = [0, 255, 0]
const BLUE: [number, number, number] = [0, 0, 255]

/** Read the colour of the first pixel of each frame */
function frameColors(result: DecodeImageResult): number[][] {
	if (result.type !== 'raster') throw new Error('Expected a raster')
	const pixels = new Uint8Array(result.buffer)
	const frameBytes = result.width * result.height * 4
	return Array.from({ length: result.frameCount }, (_, i) => [...pixels.subarray(i * frameBytes, i * frameBytes + 4)])
}

describe('decodeImage animations', () => {
	const frames: FixtureFrame[] = [
		{ color: RED, delayMs: 50 },
		{ color: GREEN, delayMs: 120 },
		{ color: BLUE, delayMs: 230 },
	]

	test('decodes every frame of a gif, resampled onto the render clock', async () => {
		const result = await decodeImage(toDataUrl('image/gif', makeAnimatedGif(4, 2, frames)), MAX_BYTES)

		expect(result).toMatchObject({
			type: 'raster',
			width: 4,
			height: 2,
			frameCount: 3,
			// Each frame is shown from the first tick it is on screen: red at 0ms, green at 50ms, blue at 170ms
			frameStartMs: [0, 100, 200],
			durationMs: 400,
		})
		expect(result.type === 'raster' && result.buffer).toBeInstanceOf(SharedArrayBuffer)
		expect(frameColors(result)).toEqual([
			[255, 0, 0, 255],
			[0, 255, 0, 255],
			[0, 0, 255, 255],
		])
	})

	test('decodes every frame of a bare base64 gif', async () => {
		const result = await decodeImage(makeAnimatedGif(4, 2, frames).toString('base64'), MAX_BYTES)
		expect(result).toMatchObject({ type: 'raster', frameCount: 3 })
	})

	test('drops frames which are never on screen at a tick', async () => {
		const result = await decodeImage(
			toDataUrl(
				'image/gif',
				makeAnimatedGif(4, 2, [
					// Shown 0-50ms, 50-80ms and 80-200ms, so green is never on screen at a tick
					{ color: RED, delayMs: 50 },
					{ color: GREEN, delayMs: 30 },
					{ color: BLUE, delayMs: 120 },
				])
			),
			MAX_BYTES
		)

		expect(result).toMatchObject({ frameCount: 2, frameStartMs: [0, 100], durationMs: 200 })
		expect(frameColors(result)).toEqual([
			[255, 0, 0, 255],
			[0, 0, 255, 255],
		])
	})

	// The webui decodes animations in the browser, resampling them with the shared AnimationFrameSampler, so that must
	// time them the same as image-rs does here
	test.each([
		[[50, 120, 230]],
		[[50, 30, 120]],
		[[40, 40, 40, 40, 40, 40, 40, 40, 40, 40]],
		[[0, 10, 20, 330]],
		[[150]],
	])('times frames the same as the shared sampler, for delays %j', async (delaysMs) => {
		const colors: [number, number, number][] = [RED, GREEN, BLUE]
		const gif = makeAnimatedGif(
			2,
			2,
			delaysMs.map((delayMs, i) => ({ color: colors[i % 3], delayMs }))
		)
		const result = await decodeImage(toDataUrl('image/gif', gif), MAX_BYTES)

		const sampler = new AnimationFrameSampler(MAX_ANIMATION_DURATION_MS)
		const frameStartMs: number[] = []
		for (const delayMs of delaysMs) {
			const sample = sampler.next(delayMs)
			if (sample.type === 'keep') frameStartMs.push(sample.startMs)
		}

		if (frameStartMs.length > 1) {
			expect(result).toMatchObject({ frameStartMs, durationMs: sampler.durationMs })
		} else {
			// A single frame is decoded as a static image
			expect(result).toMatchObject({ frameCount: 1 })
		}
	})

	test('decodes every frame of an apng', async () => {
		const result = await decodeImage(toDataUrl('image/png', makeAnimatedPng(4, 2, frames)), MAX_BYTES)

		expect(result).toMatchObject({ type: 'raster', width: 4, height: 2, frameCount: 3, frameStartMs: [0, 100, 200] })
		expect(frameColors(result)).toEqual([
			[255, 0, 0, 255],
			[0, 255, 0, 255],
			[0, 0, 255, 255],
		])
	})

	test('decodes a single frame gif as a static image', async () => {
		const result = await decodeImage(
			toDataUrl('image/gif', makeAnimatedGif(4, 2, [{ color: GREEN, delayMs: 100 }])),
			MAX_BYTES
		)

		expect(result).toMatchObject({ type: 'raster', frameCount: 1, frameStartMs: [0], durationMs: 0 })
		expect(frameColors(result)).toEqual([[0, 255, 0, 255]])
	})

	test('decodes a png as a static image', async () => {
		const result = await decodeImage(makePngDataUrl(8, 4), MAX_BYTES)
		expect(result).toMatchObject({ type: 'raster', frameCount: 1, frameStartMs: [0], durationMs: 0 })
	})

	test('scales an animation down to fit within the byte limit', async () => {
		const gif = makeAnimatedGif(64, 32, frames)
		// Room for the 3 frames at half the size
		const result = await decodeImage(toDataUrl('image/gif', gif), 3 * 32 * 16 * 4)

		expect(result).toMatchObject({ type: 'raster', width: 32, height: 16, frameCount: 3 })
		if (result.type !== 'raster') throw new Error('Expected a raster')
		expect(result.buffer.byteLength).toBeLessThanOrEqual(3 * 32 * 16 * 4)
	})
})

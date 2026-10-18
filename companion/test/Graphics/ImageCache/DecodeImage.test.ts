import { Canvas } from '@napi-rs/canvas'
import { describe, expect, test } from 'vitest'
import { decodeImage } from '../../../lib/Graphics/ImageCache/DecodeImage.js'

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

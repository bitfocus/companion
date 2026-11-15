import { Canvas, ImageData } from '@napi-rs/canvas'
import { describe, expect, test } from 'vitest'
import type { SurfaceRotation, SurfaceSchemaBitmapConfig } from '@companion-surface/host'
import { LockingGraphicsGeneratorImpl } from '../../../../lib/Instance/Surface/Thread/LockingGraphics.js'

type PixelFormat = NonNullable<SurfaceSchemaBitmapConfig['format']>

/** Turn the generator's raw output back into a canvas, to snapshot */
function toCanvas(data: Uint8Array, width: number, height: number, format: PixelFormat): Canvas {
	const bpp = format.length
	expect(data.length).toBe(width * height * bpp)

	const rgba = new Uint8ClampedArray(width * height * 4)
	const swapRedBlue = format.startsWith('bgr')
	for (let i = 0; i < width * height; i++) {
		const r = data[i * bpp + (swapRedBlue ? 2 : 0)]
		const b = data[i * bpp + (swapRedBlue ? 0 : 2)]
		rgba[i * 4] = r
		rgba[i * 4 + 1] = data[i * bpp + 1]
		rgba[i * 4 + 2] = b
		rgba[i * 4 + 3] = bpp === 4 ? data[i * bpp + 3] : 255
	}

	const canvas = new Canvas(width, height)
	canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0)
	return canvas
}

/** The height of the rows containing any non-black pixel */
function inkHeight(canvas: Canvas): number {
	const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
	let top = -1
	let bottom = -1
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4
			if (data[i] > 64 || data[i + 1] > 64 || data[i + 2] > 64) {
				if (top === -1) top = y
				bottom = y
				break
			}
		}
	}
	return top === -1 ? 0 : bottom - top + 1
}

/** Output size, as a quarter turn swaps the dimensions */
function outputSize(style: SurfaceSchemaBitmapConfig, rotation: SurfaceRotation): [number, number] {
	return rotation === 90 || rotation === -90 ? [style.h, style.w] : [style.w, style.h]
}

const KEY_SIZES: SurfaceSchemaBitmapConfig[] = [
	{ w: 72, h: 72, format: 'rgb' },
	{ w: 96, h: 96, format: 'rgb' },
	{ w: 120, h: 120, format: 'rgb' },
]

describe('LockingGraphics', () => {
	const generator = new LockingGraphicsGeneratorImpl()

	async function renderChar(style: SurfaceSchemaBitmapConfig, keyCode: number | string, rotation: SurfaceRotation) {
		const data = await generator.generatePincodeChar(style, keyCode, rotation)
		return toCanvas(data, ...outputSize(style, rotation), style.format ?? 'rgb')
	}

	async function renderValue(style: SurfaceSchemaBitmapConfig, charCount: number, rotation: SurfaceRotation) {
		const data = await generator.generatePincodeValue(style, charCount, rotation)
		return toCanvas(data, ...outputSize(style, rotation), style.format ?? 'rgb')
	}

	describe('pincode char', () => {
		for (const style of KEY_SIZES) {
			for (let digit = 0; digit <= 9; digit++) {
				test(`${style.w}x${style.h} - ${digit}`, async () => {
					await expect(await renderChar(style, digit, 0)).toMatchImageSnapshot()
				})
			}
		}

		test('digits are drawn at the requested size', async () => {
			// A font without a family is ignored by canvas, which then draws at 10px
			for (const style of KEY_SIZES) {
				const height = inkHeight(await renderChar(style, 8, 0))
				expect(height).toBeGreaterThan(style.h * 0.4)
			}
		})
	})

	describe('pincode value', () => {
		for (const style of KEY_SIZES) {
			for (const charCount of [0, 1, 4, 8]) {
				test(`${style.w}x${style.h} - ${charCount} chars`, async () => {
					await expect(await renderValue(style, charCount, 0)).toMatchImageSnapshot()
				})
			}
		}

		// Wider than twice the height, eg the Stream Deck Neo's strip
		for (const charCount of [0, 4]) {
			test(`wide 248x58 - ${charCount} chars`, async () => {
				await expect(await renderValue({ w: 248, h: 58, format: 'rgb' }, charCount, 0)).toMatchImageSnapshot()
			})
		}

		test('wide 100x40 - heading too wide for the larger font', async () => {
			await expect(await renderValue({ w: 100, h: 40, format: 'rgb' }, 4, 0)).toMatchImageSnapshot()
		})
	})

	describe('pixel formats', () => {
		for (const format of ['rgb', 'rgba', 'bgr', 'bgra'] as const) {
			test(format, async () => {
				const style: SurfaceSchemaBitmapConfig = { w: 72, h: 72, format }
				await expect(await renderChar(style, 5, 0)).toMatchImageSnapshot()
				await expect(await renderValue(style, 2, 0)).toMatchImageSnapshot(
					`LockingGraphics pixel formats ${format} value`
				)
			})
		}

		test('format defaults to rgb', async () => {
			const data = await generator.generatePincodeChar({ w: 72, h: 72 }, 5, 0)
			expect(data.length).toBe(72 * 72 * 3)
		})
	})

	describe('rotation', () => {
		for (const rotation of [90, -90, 180] as const) {
			test(`${rotation}`, async () => {
				await expect(await renderChar({ w: 72, h: 72, format: 'rgb' }, 7, rotation)).toMatchImageSnapshot()
				await expect(await renderValue({ w: 248, h: 58, format: 'rgb' }, 3, rotation)).toMatchImageSnapshot(
					`LockingGraphics rotation ${rotation} wide value`
				)
			})
		}
	})
})

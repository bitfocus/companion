import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import { beforeAll, describe, expect, test } from 'vitest'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import { Image } from '../../lib/Graphics/Image.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '../../../assets/Fonts')

/** Create a small PNG data URL suitable for drawBase64Image tests. */
function makeDataUrl(width: number, height: number, color: string): string {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = color
	ctx.fillRect(0, 0, width, height)
	return canvas.toDataURL('image/png')
}

function makeRgbBuffer(width: number, height: number, r: number, g: number, b: number): Buffer {
	const buf = Buffer.alloc(width * height * 3)
	for (let i = 0; i < buf.length; i += 3) {
		buf[i] = r
		buf[i + 1] = g
		buf[i + 2] = b
	}
	return buf
}

function makeRgbaBuffer(width: number, height: number, r: number, g: number, b: number, a: number): Buffer {
	const buf = Buffer.alloc(width * height * 4)
	for (let i = 0; i < buf.length; i += 4) {
		buf[i] = r
		buf[i + 1] = g
		buf[i + 2] = b
		buf[i + 3] = a
	}
	return buf
}

function makeArgbBuffer(width: number, height: number, a: number, r: number, g: number, b: number): Buffer {
	const buf = Buffer.alloc(width * height * 4)
	for (let i = 0; i < buf.length; i += 4) {
		buf[i] = a
		buf[i + 1] = r
		buf[i + 2] = g
		buf[i + 3] = b
	}
	return buf
}

describe('Image drawing', () => {
	beforeAll(() => {
		GlobalFonts.registerFromPath(join(FONTS_DIR, 'Arimo-Regular.ttf'), 'Companion-sans')
		// typos:disable-line wdth is part of the filename
		GlobalFonts.registerFromPath(join(FONTS_DIR, 'NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
	})

	// -------------------------------------------------------------------------
	// clear
	// -------------------------------------------------------------------------

	describe('clear', () => {
		test('resets every pixel to transparent', () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#ff0000')
			img.clear()
			const buf = img.buffer()
			for (let i = 3; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0) // alpha channel = 0 (transparent)
			}
		})
	})

	// -------------------------------------------------------------------------
	// fillColor
	// -------------------------------------------------------------------------

	describe('fillColor', () => {
		test('direct pixel assertion', () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#ff0000')
			const buf = img.buffer()
			// Every pixel should be RGBA (255, 0, 0, 255)
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(255) // R
				expect(buf[i + 1]).toBe(0) // G
				expect(buf[i + 2]).toBe(0) // B
				expect(buf[i + 3]).toBe(255) // A
			}
		})

		test('blue at 60x60 (square)', () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#0000ff')
			const buf = img.buffer()
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0)
				expect(buf[i + 1]).toBe(0)
				expect(buf[i + 2]).toBe(255)
				expect(buf[i + 3]).toBe(255)
			}
		})

		test('green at 144x58 (wide)', () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#00ff00')
			const buf = img.buffer()
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0)
				expect(buf[i + 1]).toBe(255)
				expect(buf[i + 2]).toBe(0)
				expect(buf[i + 3]).toBe(255)
			}
		})
	})

	// -------------------------------------------------------------------------
	// lines
	// -------------------------------------------------------------------------

	describe('lines', () => {
		test('crosshairs', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.horizontalLine(29, { color: '#00ff00', width: 1 })
			img.verticalLine(36, { color: '#ff4400', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('diagonal', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.line(0, 0, 72, 58, { color: '#ffff00', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('diagonal opposite direction', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.line(0, 58, 72, 0, { color: '#ff00ff', width: 3 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('horizontal at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#111111')
			img.horizontalLine(29, { color: '#00ff00', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('vertical at 72x116 (tall)', async () => {
			const img = Image.create(72, 116, 1, null)
			img.fillColor('#111111')
			img.verticalLine(36, { color: '#ff4400', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('multiple lines at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#000000')
			img.horizontalLine(15, { color: '#ff0000', width: 1 })
			img.horizontalLine(30, { color: '#00ff00', width: 1 })
			img.horizontalLine(45, { color: '#0000ff', width: 1 })
			img.verticalLine(20, { color: '#ffffff', width: 1 })
			img.verticalLine(40, { color: '#ffff00', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// box
	// -------------------------------------------------------------------------

	describe('box', () => {
		test('filled with border', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.box(10, 10, 62, 48, '#ffffff', { color: '#ff4444', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('fill only - no border', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			img.box(10, 10, 62, 48, '#0088ff')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('border only - no fill', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			img.box(10, 10, 62, 48, undefined, { color: '#ff8800', width: 3 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('outside line orientation', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			img.box(15, 15, 57, 43, '#ffffff', { color: '#ff0000', width: 4 }, 'outside')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#000000')
			img.box(5, 5, 55, 55, '#0044ff', { color: '#ffffff', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.box(10, 5, 134, 53, '#004400', { color: '#00ff00', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 72x116 (tall)', async () => {
			const img = Image.create(72, 116, 1, null)
			img.fillColor('#000000')
			img.box(5, 10, 67, 106, '#440044', { color: '#ff00ff', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// boxLine
	// -------------------------------------------------------------------------

	describe('boxLine', () => {
		test('thick outline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.boxLine(8, 8, 64, 50, { color: '#ffff00', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('thin 1px border', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.boxLine(5, 5, 67, 53, { color: '#ffffff', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#111111')
			img.boxLine(5, 5, 139, 53, { color: '#ff8800', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('outside orientation', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.boxLine(15, 15, 57, 43, { color: '#ff0000', width: 4 }, 'outside')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('center orientation', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.boxLine(15, 15, 57, 43, { color: '#ffff00', width: 4 }, 'center')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('degenerate box (x1 == x2) returns false without drawing', () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			const result = img.box(20, 10, 20, 50, '#ff0000') // x1 == x2
			expect(result).toBe(false)
			// canvas unchanged
			const buf = img.buffer()
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0x33)
			}
		})
	})

	// -------------------------------------------------------------------------
	// circle
	// -------------------------------------------------------------------------

	describe('arcStroke', () => {
		function pixelAt(buf: Buffer, width: number, x: number, y: number) {
			const idx = (y * width + x) * 4
			return { r: buf[idx], g: buf[idx + 1], b: buf[idx + 2], a: buf[idx + 3] }
		}

		test('full circle - arc pixels are colored, center is transparent', () => {
			const img = Image.create(60, 60, 1, null)
			// radius=20, center=(30,30), lineWidth=4 → arc spans r=18..22 from center
			img.arcStroke(30, 30, 20, 0, Math.PI * 2, false, { color: '#ff0000', width: 4 })
			const buf = img.buffer()

			// Center pixel (well inside ring) should be transparent
			expect(pixelAt(buf, 60, 30, 30).a).toBe(0)

			// Top of circle: (30, 10) = cy - r → should be red
			const top = pixelAt(buf, 60, 30, 10)
			expect(top.r).toBeGreaterThan(100)
			expect(top.a).toBeGreaterThan(0)

			// Right of circle: (50, 30) = cx + r → should be red
			const right = pixelAt(buf, 60, 50, 30)
			expect(right.r).toBeGreaterThan(100)
			expect(right.a).toBeGreaterThan(0)
		})

		test('lineWidth=0 - draws nothing', () => {
			const img = Image.create(60, 60, 1, null)
			img.arcStroke(30, 30, 20, 0, Math.PI * 2, false, { color: '#ff0000', width: 0 })
			const buf = img.buffer()
			for (let i = 3; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0)
			}
		})

		test('radius=0 - draws nothing', () => {
			const img = Image.create(60, 60, 1, null)
			img.arcStroke(30, 30, 0, 0, Math.PI * 2, false, { color: '#ff0000', width: 4 })
			const buf = img.buffer()
			for (let i = 3; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0)
			}
		})

		test('clockwise semicircle - colors lower half, not upper', () => {
			const img = Image.create(60, 60, 1, null)
			// CW from 0 (3 o'clock) to π (9 o'clock) = lower half (right→bottom→left)
			img.arcStroke(30, 30, 20, 0, Math.PI, false, { color: '#00ff00', width: 4 })
			const buf = img.buffer()

			// Bottom of circle (cy+r = 50) should have color
			expect(pixelAt(buf, 60, 30, 50).a).toBeGreaterThan(0)

			// Top of circle (cy-r = 10) should be transparent
			expect(pixelAt(buf, 60, 30, 10).a).toBe(0)
		})

		test('anticlockwise semicircle - colors upper half, not lower', () => {
			const img = Image.create(60, 60, 1, null)
			// CCW from 0 to π = upper half (right→top→left)
			img.arcStroke(30, 30, 20, 0, Math.PI, true, { color: '#0000ff', width: 4 })
			const buf = img.buffer()

			// Top of circle (cy-r = 10) should have color
			expect(pixelAt(buf, 60, 30, 10).a).toBeGreaterThan(0)

			// Bottom of circle (cy+r = 50) should be transparent
			expect(pixelAt(buf, 60, 30, 50).a).toBe(0)
		})

		test('snapshot - full circle and quarter arcs', async () => {
			const img = Image.create(144, 72, 1, null)
			img.fillColor('#111111')
			// Full circle on left
			img.arcStroke(36, 36, 28, 0, Math.PI * 2, false, { color: '#ff0000', width: 5 })
			// CW bottom-half in middle (green)
			img.arcStroke(72, 36, 28, 0, Math.PI, false, { color: '#00ff00', width: 5 })
			// CCW top-half on right (blue)
			img.arcStroke(108, 36, 28, 0, Math.PI, true, { color: '#0088ff', width: 5 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('snapshot - thick vs thin arc', async () => {
			const img = Image.create(144, 72, 1, null)
			img.fillColor('#111111')
			// 270° arc (0 → 3π/2) – avoids angles that normalise to the same point
			img.arcStroke(36, 36, 28, 0, Math.PI * 1.5, false, { color: '#ff8800', width: 2 })
			img.arcStroke(108, 36, 28, 0, Math.PI * 1.5, false, { color: '#ff8800', width: 14 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('circle', () => {
		test('filled full circle', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, 0, Math.PI * 2, false, '#00aaff')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('outline only', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, 0, Math.PI * 2, false, undefined, { color: '#ff8800', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('filled with outline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.circle(36, 29, 22, 22, 0, Math.PI * 2, false, '#0044ff', { color: '#ffffff', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('partial arc (border only)', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, 0, Math.PI, false, undefined, { color: '#ffff00', width: 2 }, true)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('pie slice', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, -Math.PI / 2, Math.PI, true, '#ff4400')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('pie slice with border outline', async () => {
			// Exercises the drawSlice branch inside the lineStyle block (// Draw as a pie slice, connecting to center)
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, -Math.PI / 2, Math.PI, true, '#ff4400', { color: '#ffffff', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('ellipse', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 32, 20, 0, Math.PI * 2, false, '#44ff44')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#000000')
			img.circle(30, 30, 26, 26, 0, Math.PI * 2, false, '#ff6600', { color: '#ffffff', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.circle(72, 29, 28, 24, 0, Math.PI * 2, false, '#aa00ff', { color: '#ffffff', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('outside line orientation', async () => {
			// Exercises lineOrientation='outside' branch for circle border
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 20, 20, 0, Math.PI * 2, false, '#0044ff', { color: '#ff0000', width: 4 }, false, 'outside')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('equal start and end angle resets to full circle', async () => {
			// When |startAngle - endAngle| <= 0.001 the implementation resets to 0..2π
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.circle(36, 29, 24, 24, 0, 0, false, '#00ff88')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawPath
	// -------------------------------------------------------------------------

	describe('drawPath', () => {
		test('open polyline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPath(
				[
					[5, 5],
					[36, 52],
					[67, 5],
				],
				{ color: '#00ffff', width: 2 }
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('closed triangle', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPath(
				[
					[36, 3],
					[67, 54],
					[5, 54],
				],
				{ color: '#ff44ff', width: 2 },
				true
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('zigzag at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#111111')
			img.drawPath(
				[
					[10, 5],
					[40, 52],
					[70, 5],
					[100, 52],
					[134, 5],
				],
				{ color: '#ffaa00', width: 2 }
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('staircase at 72x116 (tall)', async () => {
			const img = Image.create(72, 116, 1, null)
			img.fillColor('#111111')
			img.drawPath(
				[
					[5, 10],
					[40, 10],
					[40, 40],
					[67, 40],
					[67, 70],
					[30, 70],
					[30, 100],
					[5, 100],
				],
				{ color: '#00ffff', width: 2 }
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawFilledPath
	// -------------------------------------------------------------------------

	describe('drawFilledPath', () => {
		test('filled triangle', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawFilledPath(
				[
					[36, 3],
					[67, 54],
					[5, 54],
				],
				'#aa44ff'
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('filled diamond at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#111111')
			img.drawFilledPath(
				[
					[30, 5],
					[55, 30],
					[30, 55],
					[5, 30],
				],
				'#00aaff'
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('filled arrow at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.drawFilledPath(
				[
					[10, 24],
					[100, 24],
					[100, 10],
					[134, 29],
					[100, 48],
					[100, 34],
					[10, 34],
				],
				'#ffaa00'
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawPixelBuffer
	// -------------------------------------------------------------------------

	describe('drawPixelBuffer', () => {
		test('RGB format', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPixelBuffer(10, 10, 20, 20, makeRgbBuffer(20, 20, 255, 128, 0), 'RGB')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('RGBA format with semi-transparency', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#0000ff')
			img.drawPixelBuffer(10, 10, 20, 20, makeRgbaBuffer(20, 20, 255, 0, 0, 128), 'RGBA')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('ARGB format', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPixelBuffer(10, 10, 20, 20, makeArgbBuffer(20, 20, 255, 0, 200, 0), 'ARGB')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('RGB with 2x scale factor', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.drawPixelBuffer(5, 5, 10, 10, makeRgbBuffer(10, 10, 255, 50, 50), 'RGB', 2)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('base64 string input', async () => {
			// Exercises the typeof bufferRaw === 'string' branch
			const base64 = makeRgbBuffer(10, 10, 200, 100, 50).toString('base64')
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPixelBuffer(10, 10, 10, 10, base64, 'RGB')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('no format specified - auto-detected as ARGB from 4-byte buffer', async () => {
			// Exercises the !format branch with 4-byte/pixel buffer (treated as ARGB)
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawPixelBuffer(10, 10, 10, 10, makeArgbBuffer(10, 10, 255, 0, 180, 0))
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('RGB at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.drawPixelBuffer(10, 5, 40, 48, makeRgbBuffer(40, 48, 100, 200, 50), 'RGB')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawBase64Image
	// -------------------------------------------------------------------------

	describe('drawBase64Image', () => {
		test('fit scale - portrait source in landscape canvas', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(20, 30, '#ff0000'), 0, 0, 72, 58, 'center', 'center', 'fit')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('crop scale - landscape source in square canvas', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(40, 20, '#0000ff'), 0, 0, 60, 60, 'center', 'center', 'crop')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('fill scale - stretches to fill ignoring aspect ratio', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(20, 30, '#00aa00'), 0, 0, 72, 58, 'center', 'center', 'fill')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('fit_or_shrink - small image stays at 1:1', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			await img.drawBase64Image(makeDataUrl(20, 15, '#ffaa00'), 0, 0, 72, 58, 'center', 'center', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('fit_or_shrink - oversized image shrinks to fit', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			await img.drawBase64Image(makeDataUrl(100, 80, '#ff00ff'), 0, 0, 72, 58, 'center', 'center', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('numeric scale 0.5', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(40, 30, '#ff6600'), 0, 0, 72, 58, 'center', 'center', 0.5)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('alignment - left top', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			await img.drawBase64Image(makeDataUrl(20, 15, '#4488ff'), 0, 0, 72, 58, 'left', 'top', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('alignment - right bottom', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			await img.drawBase64Image(makeDataUrl(20, 15, '#44ff88'), 0, 0, 72, 58, 'right', 'bottom', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide) - fit', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(40, 40, '#ff4400'), 0, 0, 144, 58, 'center', 'center', 'fit')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('raw base64 string (no data URL prefix)', async () => {
			// Exercises the isBase64() branch in loadBase64Image
			const rawBase64 = new Canvas(20, 20).toBuffer('image/png').toString('base64')
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(rawBase64, 0, 0, 72, 58, 'center', 'center', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('scale zero - no image drawn', async () => {
			// Exercises the scale === 0 early-return branch
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#333333')
			await img.drawBase64Image(makeDataUrl(20, 20, '#ff0000'), 0, 0, 72, 58, 'center', 'center', 0)
			// canvas should remain unchanged (background color only)
			const buf = img.buffer()
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0x33)
				expect(buf[i + 1]).toBe(0x33)
				expect(buf[i + 2]).toBe(0x33)
			}
		})

		test('bottom valign with portrait image taller than canvas', async () => {
			// Exercises valign=bottom when scaledImageHeight > height
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(20, 80, '#00ccff'), 0, 0, 72, 58, 'center', 'bottom', 'crop')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('center valign with image taller than canvas', async () => {
			// Exercises the source.y = (imageHeight - source.h) / 2 branch (valign=center, scaledImageHeight > height)
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(20, 100, '#aa00ff'), 0, 0, 72, 58, 'center', 'center', 'crop')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('right halign with image wider than canvas', async () => {
			// Exercises halign=right when scaledImageWidth > width
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(makeDataUrl(120, 30, '#ff8800'), 0, 0, 72, 58, 'right', 'center', 'crop')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawTextLine
	// -------------------------------------------------------------------------

	describe('drawTextLine', () => {
		test('basic text', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLine(2, 14, 'Hello', '#ffffff', 12)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLine(2, 16, 'Hello Companion', '#ffffff', 14)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 72x116 (tall) multiple lines', async () => {
			const img = Image.create(72, 116, 1, null)
			img.fillColor('#000000')
			img.drawTextLine(2, 16, 'Line One', '#ffffff', 12)
			img.drawTextLine(2, 36, 'Line Two', '#ffff00', 12)
			img.drawTextLine(2, 56, 'Line Three', '#00ffff', 12)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('dummy mode returns measured width without drawing', () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			const w = img.drawTextLine(2, 14, 'Hello', '#ffffff', 12, true)
			expect(w).toBeGreaterThan(0)
			// canvas should still be all black - nothing drawn
			const buf = img.buffer()
			for (let i = 0; i < buf.length; i += 4) {
				expect(buf[i]).toBe(0)
				expect(buf[i + 1]).toBe(0)
				expect(buf[i + 2]).toBe(0)
			}
		})
	})

	// -------------------------------------------------------------------------
	// drawTextLineAligned
	// -------------------------------------------------------------------------

	describe('drawTextLineAligned', () => {
		test('center-center', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLineAligned(36, 29, 'ABC', '#ffffff', 16, 'center', 'center')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('left-top', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLineAligned(0, 0, 'ABC', '#ffffff', 16, 'left', 'top')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('right-bottom', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLineAligned(72, 58, 'ABC', '#ffffff', 16, 'right', 'bottom')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('bold weight', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLineAligned(36, 29, 'Bold', '#ffff00', 16, 'center', 'center', 'bold')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide) right-center', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.drawTextLineAligned(144, 29, 'Wide text', '#00ffff', 14, 'right', 'center')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// drawAlignedText
	// -------------------------------------------------------------------------

	describe('drawAlignedText', () => {
		test('centered', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Hello', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('auto font size', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Auto', '#88ff88', 58, { allowShrink: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('left-top aligned', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.drawAlignedText(0, 0, 72, 58, 'TL', '#ffffff', 14, { allowShrink: false, halign: 'left', valign: 'top' })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('right-bottom aligned', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#111111')
			img.drawAlignedText(0, 0, 72, 58, 'BR', '#ffffff', 14, { allowShrink: false, halign: 'right', valign: 'bottom' })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('with text outline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Hi', '#ffff00', 20, {
				allowShrink: false,
				outlineStyle: { color: '#ff0000', width: 2 },
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('multiline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Line 1\nLine 2', '#ffffff', 12, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('mono font', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Mono', '#aaffaa', 14, { allowShrink: false, font: 'companion-mono' })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('bold weight', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Bold', '#ffffff', 20, { allowShrink: false, weight: 'bold' })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('italic', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Italic', '#ffffff', 20, { allowShrink: false, italic: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('underline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Under', '#ffffff', 20, { allowShrink: false, underline: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('strikethrough', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Strike', '#ffffff', 20, { allowShrink: false, strikethrough: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('all styles combined', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'All', '#ffffff', 20, {
				allowShrink: false,
				weight: 'bold',
				italic: true,
				underline: true,
				strikethrough: true,
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('underline left-aligned multiline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Line 1\nLonger 2', '#ffffff', 12, {
				allowShrink: false,
				halign: 'left',
				underline: true,
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 144, 58, 'Wide canvas text', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 72x116 (tall)', async () => {
			const img = Image.create(72, 116, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 116, 'Tall\nCanvas\nText', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#111111')
			img.drawAlignedText(0, 0, 60, 60, 'Square', '#ff8800', 60, { allowShrink: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('auto-wrapping long text (no explicit newlines)', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'This text wraps around', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('auto size with many characters', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Hello World Button', '#ffffff', 58, { allowShrink: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('escaped \\\\n literal converted to real newline', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			// The string contains literal backslash-n which drawAlignedText converts to a real newline
			img.drawAlignedText(0, 0, 72, 58, 'Line A\\nLine B', '#ffffff', 12, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('tab character replacement', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'A\\tB', '#ffffff', 14, { allowShrink: false, halign: 'left' })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('extremely long text truncated to minimum font size', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'x'.repeat(500), '#ffffff', 58, { allowShrink: true })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text with null character is truncated at null', async () => {
			// Exercises the #sanitiseText null-character branch (// If there is a null character in the string, cut it off)
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			// Only 'Hello' should appear - everything after \0 is dropped
			img.drawAlignedText(0, 0, 72, 58, 'Hello\0World', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		// Resolution-independence: the same text drawn in a proportionally identical subregion
		// of the canvas must use the same font fraction at any canvas size.
		// The bug was that `(w*h)/5000` made the size-range selection depend on absolute pixels,
		// so a small subregion (e.g. h=25px at 72px canvas) fell into a lower range than a
		// proportionally identical large subregion (h=70px at 200px canvas), producing visually
		// different text sizes. The fix uses `w/h` which is scale-invariant.
		describe('auto size resolution independence', () => {
			for (const { label, text, heightFrac } of [
				// 50% height — existing cases
				{ label: 'short (5 chars, 50% height)', text: 'Scene', heightFrac: 0.5 },
				{ label: 'medium (11 chars, 50% height)', text: 'Hello World', heightFrac: 0.5 },
				{ label: 'longer (18 chars, 50% height)', text: 'Hello World Button', heightFrac: 0.5 },
				// 35% and 40% height — single-line labels where the bug was clearly visible:
				// at 72px canvas, h≈25px → old formula area≈0.36, 3 chars fell into Range 2 [0.43…]
				// while at 200px canvas, h≈70px → area=2.8, same 3 chars used Range 1 [0.83…]
				{ label: 'single line (3 chars, 35% height)', text: 'Act', heightFrac: 0.35 },
				{ label: 'single line (3 chars, 40% height)', text: 'Act', heightFrac: 0.4 },
				{ label: 'single line (5 chars, 35% height)', text: 'Scene', heightFrac: 0.35 },
				// Regression: "Prod101 Edit" (12 chars) diverged between 72px and 200px canvases
				// at 39–40% height.  The math is scale-invariant (verified by the proportional-mock
				// unit test in TextParser.test.ts); if these snapshots differ visually between canvas
				// sizes the root cause is skia-canvas font-hinting at small pixel sizes (≲15px).
				{ label: 'Prod101 Edit (12 chars, 39% height)', text: 'Prod101 Edit', heightFrac: 0.39 },
				{ label: 'Prod101 Edit (12 chars, 40% height)', text: 'Prod101 Edit', heightFrac: 0.4 },
			]) {
				describe(label, () => {
					test('at 72x72', async () => {
						const img = Image.create(72, 72, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 72, Math.round(72 * heightFrac), text, '#ffffff', 72, { allowShrink: true })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})

					test('at 144x144', async () => {
						const img = Image.create(144, 144, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 144, Math.round(144 * heightFrac), text, '#ffffff', 144, { allowShrink: true })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})

					test('at 200x200', async () => {
						const img = Image.create(200, 200, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 200, Math.round(200 * heightFrac), text, '#ffffff', 200, { allowShrink: true })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})
				})
			}
		})

		// Resolution-independence: full-height box with explicit font size as a fraction of canvas height.
		// This covers the case where the button text area is the full canvas and the configured
		// font size is ~39-40% of the canvas height (e.g. a label drawn with a fixed-ish font size).
		// All three canvas sizes must produce proportionally identical layouts.
		describe('fixed fontsize resolution independence', () => {
			for (const { label, text, fontFrac } of [
				{ label: 'Prod101 Edit (12 chars, fontsize 39%)', text: 'Prod101 Edit', fontFrac: 0.39 },
				{ label: 'Prod101 Edit (12 chars, fontsize 40%)', text: 'Prod101 Edit', fontFrac: 0.4 },
				{ label: 'Hello World (11 chars, fontsize 39%)', text: 'Hello World', fontFrac: 0.39 },
			]) {
				describe(label, () => {
					test('at 72x72', async () => {
						const img = Image.create(72, 72, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 72, 72, text, '#ffffff', Math.round(72 * fontFrac), { allowShrink: false })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})

					test('at 144x144', async () => {
						const img = Image.create(144, 144, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 144, 144, text, '#ffffff', Math.round(144 * fontFrac), { allowShrink: false })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})

					test('at 200x200', async () => {
						const img = Image.create(200, 200, 1, null)
						img.fillColor('#000000')
						img.drawAlignedText(0, 0, 200, 200, text, '#ffffff', Math.round(200 * fontFrac), { allowShrink: false })
						await expect(img.canvasImage).toMatchImageSnapshot()
					})
				})
			}
		})
	})

	// -------------------------------------------------------------------------
	// usingAlpha
	// -------------------------------------------------------------------------

	describe('usingAlpha', () => {
		test('draws red box at 50% alpha over blue background', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#0000ff')
			await img.usingAlpha(0.5, async () => {
				img.box(10, 10, 62, 48, '#ff0000')
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('draws text at 75% alpha at 144x58 (wide)', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#000000')
			img.box(0, 0, 144, 58, '#004400')
			await img.usingAlpha(0.75, async () => {
				img.drawAlignedText(0, 0, 144, 58, 'Alpha', '#ffffff', 18, { allowShrink: false })
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// usingRotation
	// -------------------------------------------------------------------------

	describe('usingRotation', () => {
		test('rotates box 45 degrees', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			await img.usingRotation(new DrawBounds(0, 0, 72, 58), 45, async () => {
				img.box(20, 20, 52, 38, '#ffffff')
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('rotates text 90 degrees', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			await img.usingRotation(new DrawBounds(0, 0, 72, 58), 90, async () => {
				img.drawAlignedText(0, 0, 72, 58, 'Rotated', '#00ff00', 12, { allowShrink: false })
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 60x60 (square) - rotates 180 degrees', async () => {
			const img = Image.create(60, 60, 1, null)
			img.fillColor('#000000')
			await img.usingRotation(new DrawBounds(0, 0, 60, 60), 180, async () => {
				img.drawAlignedText(0, 0, 60, 60, 'Flip', '#ff8800', 14, { allowShrink: false })
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// usingTemporaryLayer
	// -------------------------------------------------------------------------

	describe('usingTemporaryLayer', () => {
		test('composites full red layer at 50% alpha over blue', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#0000ff')
			await img.usingTemporaryLayer(0.5, async (layer) => {
				layer.fillColor('#ff0000')
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('composites partial box at 75% alpha', async () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#000000')
			img.box(0, 0, 36, 58, '#00aa00')
			await img.usingTemporaryLayer(0.75, async (layer) => {
				layer.box(18, 10, 54, 48, '#ff8800')
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('at 144x58 (wide) composites text layer', async () => {
			const img = Image.create(144, 58, 1, null)
			img.fillColor('#110011')
			img.box(0, 0, 72, 58, '#220022')
			await img.usingTemporaryLayer(0.6, async (layer) => {
				layer.drawAlignedText(0, 0, 144, 58, 'Layer', '#ffff00', 18, { allowShrink: false })
			})
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// oversampling
	// -------------------------------------------------------------------------

	describe('oversampling', () => {
		test('2x produces correct internal dimensions', () => {
			const img = Image.create(72, 58, 2, null)
			expect(img.realwidth).toBe(144)
			expect(img.realheight).toBe(116)
			expect(img.buffer().length).toBe(144 * 116 * 4)
		})

		test('fillColor at 2x', async () => {
			const img = Image.create(72, 58, 2, null)
			img.fillColor('#ff4400')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('drawAlignedText at 2x', async () => {
			const img = Image.create(72, 58, 2, null)
			img.fillColor('#000000')
			img.drawAlignedText(0, 0, 72, 58, 'Hi', '#ffffff', 14, { allowShrink: false })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('box at 2x at 36x29 (small)', async () => {
			const img = Image.create(36, 29, 2, null)
			img.fillColor('#111111')
			img.box(4, 4, 32, 25, '#4488ff', { color: '#ffffff', width: 1 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle at 2x at 60x60 (square)', async () => {
			const img = Image.create(60, 60, 2, null)
			img.fillColor('#000000')
			img.circle(30, 30, 24, 24, 0, Math.PI * 2, false, '#00aaff', { color: '#ffffff', width: 2 })
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	// -------------------------------------------------------------------------
	// Image-specific API
	// -------------------------------------------------------------------------

	describe('Image', () => {
		test('toDataURLSync returns a PNG data URL', () => {
			const img = Image.create(72, 58, 1, null)
			img.fillColor('#ff0000')
			const dataUrl = img.toDataURLSync()
			expect(dataUrl).toMatch(/^data:image\/png;base64,/)
			expect(dataUrl.length).toBeGreaterThan(100)
		})

		test('raw base64 from toDataURLSync round-trips through drawBase64Image', async () => {
			// Create a source image and grab its raw base64 (no data: prefix)
			// This exercises the isBase64() branch in Image.loadBase64Image
			const source = Image.create(20, 20, 1, null)
			source.fillColor('#aa00ff')
			const rawBase64 = source.toDataURLSync().replace(/^data:image\/png;base64,/, '')

			const img = Image.create(72, 58, 1, null)
			img.fillColor('#222222')
			await img.drawBase64Image(rawBase64, 0, 0, 72, 58, 'center', 'center', 'fit_or_shrink')
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})
})

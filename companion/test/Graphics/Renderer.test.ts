import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import { beforeAll, describe, expect, test } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import { ButtonGraphicsDecorationType, type DrawImageBuffer } from '@companion-app/shared/Model/StyleModel.js'
import { computeOversampling, GraphicsRenderer } from '../../lib/Graphics/Renderer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '../../../assets/Fonts')

beforeAll(() => {
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'Arimo-Regular.ttf'), 'Companion-sans')
	// typos:disable-line wdth is part of the filename
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
})

/** Bytes per pixel for the raw pixel formats used in these tests. */
const CHANNELS = { rgb: 3, rgba: 4 } as const

/** Build a minimal valid layered button style for the renderer. */
function makeStyle(overrides: Partial<RendererButtonStyle> = {}): RendererButtonStyle {
	return {
		style: 'button-layered',
		drawType: 'button',
		elements: [],
		decoration: ButtonGraphicsDecorationType.Border,
		show_status_icons: false,
		location: { pageNumber: 1, row: 2, column: 3 },
		pushed: false,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined,
		action_running: undefined,
		...overrides,
	}
}

/** Create a solid-colour PNG data URL of the given size. */
function makePngDataUrl(width: number, height: number, color = '#ff0000'): string {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = color
	ctx.fillRect(0, 0, width, height)
	return canvas.toDataURL('image/png')
}

describe('computeOversampling', () => {
	test('short edge <= 96 gets the full factor of 4', () => {
		expect(computeOversampling(1, 1)).toBe(4)
		expect(computeOversampling(72, 72)).toBe(4)
		expect(computeOversampling(96, 96)).toBe(4)
	})

	test('short edge 97..168 gets a factor of 2', () => {
		expect(computeOversampling(97, 97)).toBe(2)
		expect(computeOversampling(100, 100)).toBe(2)
		expect(computeOversampling(168, 168)).toBe(2)
	})

	test('short edge > 168 disables oversampling (factor of 1)', () => {
		expect(computeOversampling(169, 169)).toBe(1)
		expect(computeOversampling(200, 200)).toBe(1)
		expect(computeOversampling(288, 288)).toBe(1)
	})

	test('the decision is keyed on the short edge, not the long one', () => {
		expect(computeOversampling(300, 72)).toBe(4)
		expect(computeOversampling(300, 100)).toBe(2)
		expect(computeOversampling(300, 200)).toBe(1)
	})

	test('is stable under 90 degree rotation (width/height swap)', () => {
		expect(computeOversampling(300, 72)).toBe(computeOversampling(72, 300))
		expect(computeOversampling(300, 100)).toBe(computeOversampling(100, 300))
	})

	test('maxOversampling caps the size-based result', () => {
		expect(computeOversampling(72, 72, 1)).toBe(1)
		expect(computeOversampling(72, 72, 2)).toBe(2)
		expect(computeOversampling(72, 72, 3)).toBe(3)
	})

	test('the cap never raises the factor above the size-based rule', () => {
		// 100px short edge => size rule gives 2; a higher cap must not increase it
		expect(computeOversampling(100, 100, 4)).toBe(2)
		// 200px short edge => size rule gives 1
		expect(computeOversampling(200, 200, 4)).toBe(1)
	})
})

describe('GraphicsRenderer', () => {
	describe('drawBlank', () => {
		const location: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

		describe('cacheKey', () => {
			test('without a topbar every blank shares one key', () => {
				expect(GraphicsRenderer.generateBlankImage(false, location).cacheKey).toBe('blank:no-bar')
				expect(GraphicsRenderer.generateBlankImage(false, { pageNumber: 9, row: 9, column: 9 }).cacheKey).toBe(
					'blank:no-bar'
				)
				expect(GraphicsRenderer.generateBlankImage(false, null).cacheKey).toBe('blank:no-bar')
			})

			test('with a topbar the key is derived from the location', () => {
				expect(GraphicsRenderer.generateBlankImage(true, location).cacheKey).toBe('blank:1/2/3')
			})

			test('with a topbar, different locations get different keys', () => {
				const a = GraphicsRenderer.generateBlankImage(true, { pageNumber: 1, row: 0, column: 0 })
				const b = GraphicsRenderer.generateBlankImage(true, { pageNumber: 1, row: 0, column: 1 })
				expect(a.cacheKey).not.toBe(b.cacheKey)
			})

			test('with a topbar but no location falls back to a stable key', () => {
				expect(GraphicsRenderer.generateBlankImage(true, null).cacheKey).toBe('blank:bar')
			})

			test('topbar and no-topbar blanks never collide', () => {
				expect(GraphicsRenderer.generateBlankImage(true, location).cacheKey).not.toBe(
					GraphicsRenderer.generateBlankImage(false, location).cacheKey
				)
			})
		})

		describe('render', () => {
			test('style is null (a blank has no processed style)', () => {
				expect(GraphicsRenderer.generateBlankImage(false, location).style).toBeNull()
			})

			test('produces a buffer of width*height*channels for rgb and rgba', async () => {
				const render = GraphicsRenderer.generateBlankImage(false, location)
				const rgb = await render.drawNative(72, 72, null, 'rgb')
				const rgba = await render.drawNative(72, 72, null, 'rgba')
				expect(rgb).toHaveLength(72 * 72 * CHANNELS.rgb)
				expect(rgba).toHaveLength(72 * 72 * CHANNELS.rgba)
			})

			test('renders the topbar variant (needs fonts) to the requested size', async () => {
				const render = GraphicsRenderer.generateBlankImage(true, location)
				const buffer = await render.drawNative(72, 72, null, 'rgba')
				expect(buffer).toHaveLength(72 * 72 * CHANNELS.rgba)
			})

			test('output is sized to the requested target regardless of rotation', async () => {
				const render = GraphicsRenderer.generateBlankImage(false, location)
				const buffer = await render.drawNative(96, 96, 90, 'rgba')
				expect(buffer).toHaveLength(96 * 96 * CHANNELS.rgba)
			})
		})
	})

	describe('drawLockIcon', () => {
		test('has a single fixed content key', () => {
			expect(GraphicsRenderer.drawLockIcon().cacheKey).toBe('lock-icon')
			expect(GraphicsRenderer.drawLockIcon().cacheKey).toBe(GraphicsRenderer.drawLockIcon().cacheKey)
		})

		test('carries the lock icon style', () => {
			const render = GraphicsRenderer.drawLockIcon()
			expect(render.style?.type).toBe('button')
			expect(render.style?.text?.text).toBe('🔒')
		})

		test('renders to the requested size', async () => {
			const buffer = await GraphicsRenderer.drawLockIcon().drawNative(72, 72, null, 'rgba')
			expect(buffer).toHaveLength(72 * 72 * CHANNELS.rgba)
		})
	})

	describe('drawButtonImageBuffer', () => {
		test('produces a buffer of width*height*channels for rgb and rgba', async () => {
			const style = makeStyle()
			const rgb = await GraphicsRenderer.drawButtonImageBuffer(
				style,
				{ width: 72, height: 72, oversampling: 1 },
				null,
				'rgb'
			)
			const rgba = await GraphicsRenderer.drawButtonImageBuffer(
				style,
				{ width: 72, height: 72, oversampling: 1 },
				null,
				'rgba'
			)
			expect(rgb).toHaveLength(72 * 72 * CHANNELS.rgb)
			expect(rgba).toHaveLength(72 * 72 * CHANNELS.rgba)
		})

		test('honours the requested target resolution', async () => {
			const buffer = await GraphicsRenderer.drawButtonImageBuffer(
				makeStyle(),
				{ width: 128, height: 64, oversampling: 2 },
				null,
				'rgba'
			)
			expect(buffer).toHaveLength(128 * 64 * CHANNELS.rgba)
		})

		test('rotation keeps the output at the requested target resolution', async () => {
			const buffer = await GraphicsRenderer.drawButtonImageBuffer(
				makeStyle(),
				{ width: 72, height: 72, oversampling: 1 },
				90,
				'rgba'
			)
			expect(buffer).toHaveLength(72 * 72 * CHANNELS.rgba)
		})
	})

	describe('createImagePreview', () => {
		test('preserves dimensions for images at or below the 200px cap', async () => {
			const result = await GraphicsRenderer.createImagePreview(makePngDataUrl(150, 100))
			expect(result.width).toBe(150)
			expect(result.height).toBe(100)
			expect(result.previewDataUrl.startsWith('data:image/webp')).toBe(true)
		})

		test('downsizes a large landscape image to fit 200px on the long edge', async () => {
			const result = await GraphicsRenderer.createImagePreview(makePngDataUrl(400, 200))
			// Reported dimensions are the ORIGINAL size
			expect(result.width).toBe(400)
			expect(result.height).toBe(200)
			expect(result.previewDataUrl.startsWith('data:image/webp')).toBe(true)
		})

		test('downsizes a large portrait image to fit 200px on the long edge', async () => {
			const result = await GraphicsRenderer.createImagePreview(makePngDataUrl(200, 400))
			expect(result.width).toBe(200)
			expect(result.height).toBe(400)
		})

		test('rejects with a friendly error for an unloadable image', async () => {
			await expect(GraphicsRenderer.createImagePreview('not-a-valid-data-url')).rejects.toThrow(
				'Failed to process image'
			)
		})
	})

	describe('drawImageBuffers', () => {
		/** A raw RGBA pixel buffer of the given size, filled with one colour. */
		function makeRgbaBuffer(width: number, height: number): DrawImageBuffer {
			const buffer = Buffer.alloc(width * height * 4)
			for (let i = 0; i < width * height; i++) {
				buffer[i * 4] = 10
				buffer[i * 4 + 1] = 20
				buffer[i * 4 + 2] = 30
				buffer[i * 4 + 3] = 255
			}
			return {
				buffer,
				x: 0,
				y: 0,
				width,
				height,
				drawScale: undefined,
				pixelFormat: 'RGBA',
			}
		}

		test('returns an image data url', async () => {
			const result = await GraphicsRenderer.drawImageBuffers(false, [makeRgbaBuffer(72, 72)])
			expect(result.startsWith('data:image/')).toBe(true)
		})

		test('handles an empty buffer list', async () => {
			const result = await GraphicsRenderer.drawImageBuffers(false, [])
			expect(result.startsWith('data:image/')).toBe(true)
		})

		test('renders with and without a topbar', async () => {
			const withBar = await GraphicsRenderer.drawImageBuffers(true, [makeRgbaBuffer(72, 58)])
			const withoutBar = await GraphicsRenderer.drawImageBuffers(false, [makeRgbaBuffer(72, 72)])
			expect(withBar.startsWith('data:image/')).toBe(true)
			expect(withoutBar.startsWith('data:image/')).toBe(true)
		})

		test('skips entries with no buffer without throwing', async () => {
			const emptyEntry: DrawImageBuffer = {
				buffer: undefined,
				x: 0,
				y: 0,
				width: 72,
				height: 72,
				drawScale: undefined,
				pixelFormat: 'RGBA',
			}
			const result = await GraphicsRenderer.drawImageBuffers(false, [emptyEntry])
			expect(result.startsWith('data:image/')).toBe(true)
		})
	})
})

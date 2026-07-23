import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import { beforeAll, describe, expect, test } from 'vitest'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsGaugeDrawElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsTextDrawElement,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import { Image } from '../../lib/Graphics/Image.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '../../../assets/Fonts')

const DEFAULT_PADDING = { x: 2, y: 2 }

/** Create a small PNG data URL for image element tests. */
function makeDataUrl(width: number, height: number, color: string): string {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = color
	ctx.fillRect(0, 0, width, height)
	return canvas.toDataURL('image/png')
}

/** Build a minimal RendererButtonStyle. */
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

const ELEMENT_BASE = {
	usage: ButtonGraphicsElementUsage.Automatic,
	enabled: true,
	opacity: 1,
	contentHash: '',
}

function makeTextElement(overrides: Partial<ButtonGraphicsTextDrawElement> = {}): ButtonGraphicsTextDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'text-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		text: 'Hello',
		fontsize: 100,
		fontsizeAllowShrink: true,
		font: 'companion-sans',
		color: 0xffffff, // white
		outlineColor: 0xff000000, // alpha=0 → no outline
		halign: 'center',
		valign: 'center',
		...overrides,
	}
}

function makeBoxElement(overrides: Partial<ButtonGraphicsBoxDrawElement> = {}): ButtonGraphicsBoxDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'box-1',
		type: 'box',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		color: 0xff0000, // red
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		...overrides,
	}
}

function makeLineElement(overrides: Partial<ButtonGraphicsLineDrawElement> = {}): ButtonGraphicsLineDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'line-1',
		type: 'line',
		fromX: 0,
		fromY: 0,
		toX: 1,
		toY: 1,
		borderWidth: 0.01,
		borderColor: 0xffffff, // white
		borderPosition: 'inside',
		...overrides,
	}
}

function makeCircleElement(overrides: Partial<ButtonGraphicsCircleDrawElement> = {}): ButtonGraphicsCircleDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'circle-1',
		type: 'circle',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		color: 0x0000ff, // blue
		startAngle: 0,
		endAngle: 360,
		drawSlice: false,
		borderOnlyArc: false,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		...overrides,
	}
}

function makeImageElement(
	base64Image: string | null,
	overrides: Partial<ButtonGraphicsImageDrawElement> = {}
): ButtonGraphicsImageDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'image-1',
		type: 'image',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		base64Image,
		halign: 'center',
		valign: 'center',
		fillMode: 'fit',
		...overrides,
	}
}

function makeGroupElement(
	children: SomeButtonGraphicsDrawElement[],
	overrides: Partial<ButtonGraphicsGroupDrawElement> = {}
): ButtonGraphicsGroupDrawElement {
	return {
		...ELEMENT_BASE,
		id: 'group-1',
		type: 'group',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		squareCoords: false,
		children,
		...overrides,
	}
}

beforeAll(() => {
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'Arimo-Regular.ttf'), 'Companion-sans')
	// typos:disable-line wdth is part of the filename
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
})

describe('GraphicsLayeredButtonRenderer', () => {
	describe('decoration', () => {
		test('decoration=topbar - top bar drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ decoration: ButtonGraphicsDecorationType.TopBar }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('decoration=border, not pushed - nothing drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ decoration: ButtonGraphicsDecorationType.Border }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('decoration=border, pushed - border drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ decoration: ButtonGraphicsDecorationType.Border, pushed: true }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('decoration=none - nothing drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ decoration: ButtonGraphicsDecorationType.None }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('show_status_icons', () => {
		test('show_status_icons=true with error - icon drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ decoration: ButtonGraphicsDecorationType.TopBar, show_status_icons: true, button_status: 'error' }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('show_status_icons=false with error - icon suppressed', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					decoration: ButtonGraphicsDecorationType.TopBar,
					show_status_icons: false,
					button_status: 'error',
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('element types', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('text element', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement()] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text element with outline', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ outlineColor: 0xff0000 })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		// The text outline width is proportional to the font size, so it should keep a consistent visual
		// weight relative to the text across canvas sizes, oversampling factors and font sizes (rather than
		// being a fixed pixel width). These snapshots let us eyeball the thickness across that matrix.
		describe('text outline thickness', () => {
			const resolutions = [
				{ name: '72x58 1x', width: 72, height: 58, oversampling: 1 },
				{ name: '72x58 2x', width: 72, height: 58, oversampling: 2 },
				{ name: '144x116 1x', width: 144, height: 116, oversampling: 1 },
				{ name: '288x232 1x', width: 288, height: 232, oversampling: 1 },
			] as const
			const fontSizes = [25, 50, 100, 200] as const

			for (const res of resolutions) {
				for (const fontsize of fontSizes) {
					test(`${res.name} - fontsize ${fontsize}`, async () => {
						const img = Image.create(res.width, res.height, res.oversampling, null)
						await GraphicsLayeredButtonRenderer.draw(
							img,
							makeStyle({
								...drawOpts,
								elements: [makeTextElement({ outlineColor: 0xff0000, fontsize, fontsizeAllowShrink: false })],
							}),
							new Set(),
							null,
							DEFAULT_PADDING
						)
						await expect(img.canvasImage).toMatchImageSnapshot()
					})
				}
			}
		})

		test('box element', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeBoxElement()] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('line element', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeLineElement()] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle element', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeCircleElement()] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('image element with base64 png', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeImageElement(makeDataUrl(36, 36, '#00cc00'))] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('image element with null base64 - nothing drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeImageElement(null)] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('group element with text child', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeGroupElement([makeTextElement()])] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('skipDraw', () => {
		test('element with enabled=false - not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement({ enabled: false })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('element id in elementsToHide - not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement({ id: 'hidden-box' })] }),
				new Set(['hidden-box']),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('selectedElementId', () => {
		test('null - no red crosshair', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement()] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('matching element id - red crosshair at element bounds', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement({ id: 'sel-box' })] }),
				new Set(),
				'sel-box',
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('padding', () => {
		test('no padding - box fills full draw area', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement({ color: 0x00ffff })] }),
				new Set(),
				null,
				{ x: 0, y: 0 }
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('large padding - box inset from all edges', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeBoxElement({ color: 0x00ffff })] }),
				new Set(),
				null,
				{ x: 8, y: 8 }
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('combined', () => {
		test('full button: topbar + text + error icon + pushed', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					decoration: ButtonGraphicsDecorationType.TopBar,
					show_status_icons: true,
					pushed: true,
					button_status: 'error',
					elements: [makeTextElement({ text: 'ACTION' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('group with squareCoords=true and text child', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					elements: [makeGroupElement([makeTextElement({ text: 'SQ' })], { squareCoords: true })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('skipDraw per element type', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('text element with enabled=false - not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ enabled: false })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('image element with enabled=false - not drawn even with valid base64', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeImageElement(makeDataUrl(36, 36, '#00cc00'), { enabled: false })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('line element with enabled=false - not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeLineElement({ enabled: false })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle element with enabled=false - not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeCircleElement({ enabled: false })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('group element with enabled=false - group and children not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeGroupElement([makeBoxElement({ color: 0xff0000 })], { enabled: false })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('group in elementsToHide - children also not drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeGroupElement([makeBoxElement({ color: 0xff0000 })], { id: 'hidden-group' })],
				}),
				new Set(['hidden-group']),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('image error case', () => {
		// drawBase64Image returns false (error) for load failures, null for intentional skips (no data,
		// scale<=0, too-small). Only false triggers the red cross in #drawImageElement.
		test('invalid base64 image - draws red error cross', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					decoration: ButtonGraphicsDecorationType.Border,
					elements: [makeImageElement('data:image/png;base64,NOTVALIDBASE64NOTVALIDBASE64NOTVALIDBASE64!!!')],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('selectedElementId through nesting', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('group element selected - crosshair at group bounds', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeGroupElement([makeBoxElement()], {
							id: 'sel-group',
							x: 0.1,
							y: 0.1,
							width: 0.8,
							height: 0.8,
						}),
					],
				}),
				new Set(),
				'sel-group',
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('child element inside group selected - crosshair at child bounds within group', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeGroupElement([makeBoxElement({ id: 'sel-child', x: 0.25, y: 0.25, width: 0.5, height: 0.5 })], {
							x: 0.1,
							y: 0.1,
							width: 0.8,
							height: 0.8,
						}),
					],
				}),
				new Set(),
				'sel-child',
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('selected child inside hidden group - bounds still computed, crosshair drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeGroupElement([makeBoxElement({ id: 'sel-child-hidden' })], { id: 'hidden-group' })],
				}),
				new Set(['hidden-group']),
				'sel-child-hidden',
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('box properties', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('box at sub-bounds position', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeBoxElement({ x: 0.1, y: 0.2, width: 0.4, height: 0.6 })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('box with border inside', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeBoxElement({ borderWidth: 0.05, borderColor: 0xffff00, borderPosition: 'inside' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('box with border outside', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeBoxElement({ borderWidth: 0.05, borderColor: 0xffff00, borderPosition: 'outside' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('box with rotation', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeBoxElement({ rotation: 45, x: 0.25, y: 0.25, width: 0.5, height: 0.5 })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('box with opacity - semi-transparent over another element', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeBoxElement({ color: 0x0000ff }),
						makeBoxElement({ id: 'box-2', color: 0xff0000, opacity: 0.5, x: 0.1, y: 0.1, width: 0.8, height: 0.8 }),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('text properties', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('text halign left', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ halign: 'left' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text halign right', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ halign: 'right' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text valign top', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ valign: 'top' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text valign bottom', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ valign: 'bottom' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text fixed fontsize', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeTextElement({ fontsize: 18, fontsizeAllowShrink: false, text: 'Big' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text empty string - nothing drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ text: '' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text with rotation', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeTextElement({ rotation: 45, x: 0.1, y: 0.1, width: 0.8, height: 0.8 })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('text companion-mono font', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeTextElement({ font: 'companion-mono' })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('circle properties', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('circle partial arc (0 to 270 degrees)', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [makeCircleElement({ startAngle: 0, endAngle: 270 })] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle with drawSlice=true', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeCircleElement({ startAngle: 0, endAngle: 270, drawSlice: true })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle with borderOnlyArc=true', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeCircleElement({
							startAngle: 0,
							endAngle: 270,
							borderOnlyArc: true,
							borderWidth: 0.05,
							borderColor: 0xffff00,
						}),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('circle with visible border', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeCircleElement({ borderWidth: 0.05, borderColor: 0xffff00, borderPosition: 'inside' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('image properties', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('image fillMode=fill - stretches to fill bounds ignoring aspect ratio', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeImageElement(makeDataUrl(100, 20, '#ff6600'), { fillMode: 'fill' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('image fillMode=crop - crops to fill bounds', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [makeImageElement(makeDataUrl(100, 20, '#ff6600'), { fillMode: 'crop' })],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('image with rotation', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeImageElement(makeDataUrl(36, 18, '#0099ff'), {
							rotation: 45,
							x: 0.1,
							y: 0.1,
							width: 0.8,
							height: 0.8,
						}),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('group properties', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		test('group with multiple children at different sub-bounds', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeGroupElement(
							[
								makeBoxElement({ id: 'box-top', color: 0xff0000, x: 0, y: 0, width: 1, height: 0.5 }),
								makeBoxElement({ id: 'box-bottom', color: 0x0000ff, x: 0, y: 0.5, width: 1, height: 0.5 }),
							],
							{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
						),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('nested groups - group inside group', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeGroupElement(
							[
								makeGroupElement([makeBoxElement({ color: 0x00ff00 })], {
									id: 'inner-group',
									x: 0.25,
									y: 0.25,
									width: 0.5,
									height: 0.5,
								}),
							],
							{ id: 'outer-group' }
						),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('group with rotation', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					...drawOpts,
					elements: [
						makeGroupElement([makeBoxElement({ color: 0xff8800 })], {
							rotation: 30,
							x: 0.1,
							y: 0.1,
							width: 0.8,
							height: 0.8,
						}),
					],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('gauge element', () => {
		const DEFAULT_STOPS: ButtonGraphicsGaugeDrawElement['stops'] = [
			{ value: 0, color: 0x00ff00, gradient: false },
			{ value: 66, color: 0xffff00, gradient: false },
			{ value: 85, color: 0xff0000, gradient: false },
		]

		function makeGaugeElement(overrides: Partial<ButtonGraphicsGaugeDrawElement> = {}): ButtonGraphicsGaugeDrawElement {
			return {
				...ELEMENT_BASE,
				id: 'gauge-1',
				type: 'gauge',
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				rotation: 0,
				value: 50,
				min: 0,
				max: 100,
				origin: 0,
				symmetric: false,
				orientation: 'horizontal',
				reverse: false,
				trackWidth: 100,
				startAngle: 0,
				endAngle: 360,
				ringWidth: 20,
				roundedEnds: true,
				fillEnabled: true,
				multiColour: true,
				stops: DEFAULT_STOPS,
				markerEnabled: false,
				markerColor: 0xffffff,
				markerWidth: 15,
				trackStyle: 'transparent',
				trackAmount: 70,
				...overrides,
			}
		}

		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		async function drawGauge(gauge: ButtonGraphicsGaugeDrawElement, size = { w: 72, h: 58 }): Promise<Canvas> {
			const img = Image.create(size.w, size.h, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [gauge] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			return img.canvasImage
		}

		test('value=0 - only inactive background visible', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 0 }))).toMatchImageSnapshot()
		})

		test('value=50 - first segment partially active', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 50 }))).toMatchImageSnapshot()
		})

		test('value=75 - two segments active (green + yellow), red inactive', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 75 }))).toMatchImageSnapshot()
		})

		test('value=100 - all segments active, no inactive', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 100 }))).toMatchImageSnapshot()
		})

		test('reverse=true - fills from right', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 50, reverse: true }))).toMatchImageSnapshot()
		})

		test('multiColour=false - single color for entire active region', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 75, multiColour: false }))).toMatchImageSnapshot()
		})

		test('trackStyle=dimmed - inactive portions darkened', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 50, trackStyle: 'dimmed', trackAmount: 70 }))
			).toMatchImageSnapshot()
		})

		test('trackAmount=0 - inactive portions invisible', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 50, trackAmount: 0 }))).toMatchImageSnapshot()
		})

		test('trackAmount=100 - inactive same as active color', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 50, trackAmount: 100 }))).toMatchImageSnapshot()
		})

		test('orientation=vertical reverse=false - fills from bottom', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 50, orientation: 'vertical' }))).toMatchImageSnapshot()
		})

		test('orientation=vertical reverse=true - fills from top', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 50, orientation: 'vertical', reverse: true }))
			).toMatchImageSnapshot()
		})

		test('empty stops - nothing drawn', async () => {
			await expect(await drawGauge(makeGaugeElement({ stops: [] }))).toMatchImageSnapshot()
		})

		test('single segment - full bar one color', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 50, stops: [{ value: 0, color: 0x0088ff }] }))
			).toMatchImageSnapshot()
		})

		// Helper: draw a gauge on top of a dark box so inactive transparent arcs are visible
		async function drawRing(
			overrides: Partial<ButtonGraphicsGaugeDrawElement>,
			size = { w: 72, h: 72 }
		): Promise<Canvas> {
			const img = Image.create(size.w, size.h, 1, null)
			const bg = makeBoxElement({ color: 0x222222 })
			const gauge = makeGaugeElement({ orientation: 'ring', ...overrides })
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements: [bg, gauge] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			return img.canvasImage
		}

		test('ring value=33 - one color, within first segment', async () => {
			await expect(await drawRing({ value: 33 })).toMatchImageSnapshot()
		})

		test('ring value=50 - midway through first segment', async () => {
			await expect(await drawRing({ value: 50 })).toMatchImageSnapshot()
		})

		test('ring value=66 - exactly at first segment boundary', async () => {
			await expect(await drawRing({ value: 66 })).toMatchImageSnapshot()
		})

		test('ring value=75 - crossing into yellow segment', async () => {
			await expect(await drawRing({ value: 75 })).toMatchImageSnapshot()
		})

		test('ring value=90 - crossing into red segment', async () => {
			await expect(await drawRing({ value: 90 })).toMatchImageSnapshot()
		})

		test('ring value=0 - inactive arc only (dark bg makes it visible)', async () => {
			await expect(await drawRing({ value: 0 })).toMatchImageSnapshot()
		})

		test('ring value=100 - fully active', async () => {
			await expect(await drawRing({ value: 100 })).toMatchImageSnapshot()
		})

		test('ring value=75 dimmed inactive - both halves clearly visible', async () => {
			await expect(await drawRing({ value: 75, trackStyle: 'dimmed', trackAmount: 40 })).toMatchImageSnapshot()
		})

		test('ring reverse=true value=75 - counter-clockwise', async () => {
			await expect(await drawRing({ value: 75, reverse: true })).toMatchImageSnapshot()
		})

		test('ring thin ringWidth=8', async () => {
			await expect(await drawRing({ value: 75, ringWidth: 8 })).toMatchImageSnapshot()
		})

		test('ring thick ringWidth=40', async () => {
			await expect(await drawRing({ value: 75, ringWidth: 40 })).toMatchImageSnapshot()
		})

		test('ring multiColour=false value=75 - single color active', async () => {
			await expect(await drawRing({ value: 75, multiColour: false })).toMatchImageSnapshot()
		})

		test('ring roundedEnds=false value=75 - flat ends', async () => {
			await expect(await drawRing({ value: 75, roundedEnds: false })).toMatchImageSnapshot()
		})

		test('ring in non-square element - stays circular', async () => {
			await expect(await drawRing({ value: 50 }, { w: 72, h: 58 })).toMatchImageSnapshot()
		})

		test('unsorted stops - sorted before rendering', async () => {
			await expect(
				await drawGauge(
					makeGaugeElement({
						value: 75,
						stops: [
							{ value: 85, color: 0xff0000 },
							{ value: 0, color: 0x00ff00 },
							{ value: 66, color: 0xffff00 },
						],
					})
				)
			).toMatchImageSnapshot()
		})

		// --- Value mapping: min / max / origin / symmetric ---

		test('min/max maps an arbitrary range onto the gauge', async () => {
			// Audio-style range: value 0 sits ~91% of the way along -232..24
			await expect(await drawGauge(makeGaugeElement({ value: 0, min: -232, max: 24 }))).toMatchImageSnapshot()
		})

		test('origin at midpoint - pan fills right of centre', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 75, origin: 50, stops: [{ value: 0, color: 0x00aaff }] }))
			).toMatchImageSnapshot()
		})

		test('origin at midpoint - pan fills left of centre', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 25, origin: 50, stops: [{ value: 0, color: 0x00aaff }] }))
			).toMatchImageSnapshot()
		})

		test('symmetric - fill grows both ways from origin (stereo width)', async () => {
			await expect(
				await drawGauge(
					makeGaugeElement({ value: 60, origin: 50, symmetric: true, stops: [{ value: 0, color: 0x00ff88 }] })
				)
			).toMatchImageSnapshot()
		})

		// --- Track width: fill is wider than the (narrowed) track ---

		test('trackWidth=40 - fill wider than track', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 60, trackWidth: 40 }))).toMatchImageSnapshot()
		})

		test('vertical trackWidth=50 - narrow track, full-width fill', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 60, orientation: 'vertical', trackWidth: 50 }))
			).toMatchImageSnapshot()
		})

		test('ring trackWidth=50 - track narrower than fill within ring width', async () => {
			await expect(await drawRing({ value: 75, trackWidth: 50 })).toMatchImageSnapshot()
		})

		// --- Fill toggle ---

		test('fillEnabled=false - only the track renders', async () => {
			await expect(await drawGauge(makeGaugeElement({ value: 75, fillEnabled: false }))).toMatchImageSnapshot()
		})

		// --- Gradient stops ---

		test('gradient stop - blends toward the next stop color', async () => {
			await expect(
				await drawGauge(
					makeGaugeElement({
						value: 100,
						stops: [
							{ value: 0, color: 0x00ff00, gradient: true },
							{ value: 100, color: 0xff0000, gradient: false },
						],
					})
				)
			).toMatchImageSnapshot()
		})

		test('first stop not at zero - anchored so no gap forms', async () => {
			await expect(
				await drawGauge(
					makeGaugeElement({
						value: 100,
						stops: [
							{ value: 40, color: 0x00ff00 },
							{ value: 80, color: 0xff0000 },
						],
					})
				)
			).toMatchImageSnapshot()
		})

		// --- Marker ---

		test('marker - line at value, rounded caps with roundedEnds', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 50, markerEnabled: true, markerColor: 0xffffff }))
			).toMatchImageSnapshot()
		})

		test('marker - flat caps when roundedEnds=false', async () => {
			await expect(
				await drawGauge(makeGaugeElement({ value: 50, markerEnabled: true, markerColor: 0xffffff, roundedEnds: false }))
			).toMatchImageSnapshot()
		})

		test('marker - mirrors in symmetric mode', async () => {
			await expect(
				await drawGauge(
					makeGaugeElement({
						value: 60,
						origin: 50,
						symmetric: true,
						markerEnabled: true,
						markerColor: 0xffffff,
						stops: [{ value: 0, color: 0x00ff88 }],
					})
				)
			).toMatchImageSnapshot()
		})

		test('ring marker - arc bead following the curve', async () => {
			await expect(
				await drawRing({ value: 50, markerEnabled: true, markerColor: 0xffffff, markerWidth: 25 })
			).toMatchImageSnapshot()
		})

		// --- Circular start/end angle (gap positioning) ---

		test('ring partial arc - gap at the bottom (270° arc)', async () => {
			await expect(await drawRing({ value: 75, startAngle: 225, endAngle: 135 })).toMatchImageSnapshot()
		})

		test('ring partial arc - rounded track ends follow roundedEnds', async () => {
			await expect(
				await drawRing({ value: 40, startAngle: 225, endAngle: 135, roundedEnds: true })
			).toMatchImageSnapshot()
		})

		test('ring partial arc - flat track ends when roundedEnds=false', async () => {
			await expect(
				await drawRing({ value: 40, startAngle: 225, endAngle: 135, roundedEnds: false })
			).toMatchImageSnapshot()
		})
	})

	describe('css color formats', () => {
		const drawOpts = { decoration: ButtonGraphicsDecorationType.Border, show_status_icons: false } as const

		async function renderCanvas(elements: SomeButtonGraphicsDrawElement[]) {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ ...drawOpts, elements }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			return img.canvasImage
		}

		const renderPng = async (elements: SomeButtonGraphicsDrawElement[]): Promise<Buffer> =>
			(await renderCanvas(elements)).toBuffer('image/png')

		// Every css form of red must render identically to the packed-number form (0xff0000)
		test.each([
			['hex', '#ff0000'],
			['hex short', '#f00'],
			['rgb', 'rgb(255, 0, 0)'],
			['rgb spaces', 'rgb(255 0 0)'],
			['hsl', 'hsl(0, 100%, 50%)'],
		])('text color as %s renders identical to the numeric form', async (_name, css) => {
			const fromString = await renderPng([makeTextElement({ color: css })])
			const fromNumber = await renderPng([makeTextElement({ color: 0xff0000 })])
			expect(fromString.equals(fromNumber)).toBe(true)
		})

		test('box element with a css color string', async () => {
			await expect(await renderCanvas([makeBoxElement({ color: '#00c800' })])).toMatchImageSnapshot()
		})

		test('text outline as a css color string draws an outline', async () => {
			await expect(await renderCanvas([makeTextElement({ outlineColor: 'rgb(255, 0, 0)' })])).toMatchImageSnapshot()
		})

		test('a fully transparent css outline draws no outline', async () => {
			const cssTransparent = await renderPng([makeTextElement({ outlineColor: 'rgba(0, 0, 0, 0)' })])
			const numericTransparent = await renderPng([makeTextElement({ outlineColor: 0xff000000 })]) // alpha byte 0xff = transparent
			expect(cssTransparent.equals(numericTransparent)).toBe(true)
		})
	})
})

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import { beforeAll, describe, expect, test } from 'vitest'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsTextDrawElement,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
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
		show_topbar: false,
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

/** Build a canvas background element controlling the decoration type. */
function makeCanvasElement(decoration: ButtonGraphicsDecorationType): ButtonGraphicsCanvasDrawElement {
	return {
		id: 'canvas-bg',
		usage: ButtonGraphicsElementUsage.Automatic,
		contentHash: '',
		type: 'canvas',
		decoration,
		showStatusIcons: ButtonGraphicsShowStatusIcons.FollowDefault,
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
		fontsize: '0', // Number('0') = 0 → falsy → 'auto'
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
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
})

describe('GraphicsLayeredButtonRenderer', () => {
	describe('decoration', () => {
		test('show_topbar=true - FollowDefault resolves to TopBar', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(img, makeStyle({ show_topbar: true }), new Set(), null, DEFAULT_PADDING)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('show_topbar=false not pushed - FollowDefault resolves to Border (nothing visible)', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(img, makeStyle({ show_topbar: false }), new Set(), null, DEFAULT_PADDING)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('show_topbar=false pushed - Border decoration border visible', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ show_topbar: false, pushed: true }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('canvas element decoration=None - no decoration drawn', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({ elements: [makeCanvasElement(ButtonGraphicsDecorationType.None)] }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('canvas element decoration=TopBar overrides show_topbar=false', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					show_topbar: false,
					elements: [makeCanvasElement(ButtonGraphicsDecorationType.TopBar)],
				}),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('canvas element decoration=Border pushed - border visible', async () => {
			const img = Image.create(72, 58, 1, null)
			await GraphicsLayeredButtonRenderer.draw(
				img,
				makeStyle({
					pushed: true,
					elements: [makeCanvasElement(ButtonGraphicsDecorationType.Border)],
				}),
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
				makeStyle({ show_topbar: true, show_status_icons: true, button_status: 'error' }),
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
				makeStyle({ show_topbar: true, show_status_icons: false, button_status: 'error' }),
				new Set(),
				null,
				DEFAULT_PADDING
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('element types', () => {
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
					show_topbar: true,
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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
					show_topbar: false,
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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
				makeStyle({ ...drawOpts, elements: [makeTextElement({ fontsize: '18', text: 'Big' })] }),
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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
		const drawOpts = { show_topbar: false, show_status_icons: false } as const

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
})

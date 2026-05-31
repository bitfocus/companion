import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GlobalFonts } from '@napi-rs/canvas'
import { beforeAll, describe, expect, test } from 'vitest'
import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type { DrawStyleButtonStateProps } from '@companion-app/shared/Model/StyleModel.js'
import { Image } from '../../lib/Graphics/Image.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '../../../assets/Fonts')

/** Construct a minimal RendererButtonStyle for drawIcons tests. */
function makeButtonStyle(
	overrides: Partial<Pick<RendererButtonStyle, 'pushed' | 'button_status' | 'action_running'>> = {}
): RendererButtonStyle {
	return {
		style: 'button-layered',
		drawType: 'button',
		elements: [],
		show_topbar: true,
		show_status_icons: true,
		location: { pageNumber: 1, row: 2, column: 3 },
		pushed: false,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined,
		action_running: undefined,
		...overrides,
	}
}

/** Construct a minimal drawStatusBar drawStyle. */
function makeStatusStyle(
	overrides: Partial<{
		pushed: boolean
		stepCurrent: number
		stepCount: number
		button_status: RendererButtonStyle['button_status']
		action_running: boolean | undefined
		location: RendererButtonStyle['location']
	}> = {}
) {
	return {
		pushed: false,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined as RendererButtonStyle['button_status'],
		action_running: undefined as boolean | undefined,
		location: { pageNumber: 1, row: 2, column: 3 } as RendererButtonStyle['location'],
		...overrides,
	}
}

/** Construct a minimal DrawStyleButtonStateProps. */
function makePushStyle(pushed: boolean): DrawStyleButtonStateProps {
	return {
		pushed,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined,
		action_running: undefined,
	}
}

/** Create a fresh Image and its proportionally-scaled topBar / outer DrawBounds. */
function makeCanvas(w: number, h: number) {
	const img = Image.create(w, h, 1, null)
	const topBarH = Math.round((h * ButtonDecorationRenderer.DEFAULT_HEIGHT) / 58)
	const topBarBounds = new DrawBounds(0, 0, w, topBarH)
	const outerBounds = new DrawBounds(0, 0, w, h)
	return { img, topBarBounds, outerBounds }
}

beforeAll(() => {
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'Arimo-Regular.ttf'), 'Companion-sans')
	GlobalFonts.registerFromPath(join(FONTS_DIR, 'NotoSansMono-wdth-wght.ttf'), 'Companion-mono')
})

describe('ButtonDecorationRenderer', () => {
	describe('drawStatusBar', () => {
		test('empty button - no location', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(img, makeStatusStyle({ location: undefined }), topBarBounds, true)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('non-empty - single step - no location (preview)', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(img, makeStatusStyle({ location: undefined }), topBarBounds, false)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('non-empty - multi step - no location', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(
				img,
				makeStatusStyle({ location: undefined, stepCount: 3, stepCurrent: 2 }),
				topBarBounds,
				false
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('non-empty - with location - not pushed', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(img, makeStatusStyle(), topBarBounds, false)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('non-empty - with location - pushed', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(img, makeStatusStyle({ pushed: true }), topBarBounds, false)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('multi step - with location - pushed', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawStatusBar(
				img,
				makeStatusStyle({ pushed: true, stepCount: 3, stepCurrent: 2 }),
				topBarBounds,
				false
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('drawBorderWhenPushed', () => {
		test('pushed - draws yellow border', async () => {
			const { img, outerBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawBorderWhenPushed(img, makePushStyle(true), outerBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('not pushed - canvas unchanged', async () => {
			const { img, outerBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawBorderWhenPushed(img, makePushStyle(false), outerBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('drawIcons', () => {
		test('no status - no action running', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(img, makeButtonStyle(), topBarBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('error status', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(img, makeButtonStyle({ button_status: 'error' }), topBarBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('warning status', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(img, makeButtonStyle({ button_status: 'warning' }), topBarBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('action running - not pushed', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(img, makeButtonStyle({ action_running: true }), topBarBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('action running - pushed', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(img, makeButtonStyle({ action_running: true, pushed: true }), topBarBounds)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})

		test('error status with action running', async () => {
			const { img, topBarBounds } = makeCanvas(72, 58)
			ButtonDecorationRenderer.drawIcons(
				img,
				makeButtonStyle({ button_status: 'error', action_running: true }),
				topBarBounds
			)
			await expect(img.canvasImage).toMatchImageSnapshot()
		})
	})

	describe('combined rendering', () => {
		const sizes: Array<[number, number, string]> = [
			[72, 58, 'standard 72x58'],
			[144, 116, 'double 144x116'],
			[36, 29, 'half 36x29'],
		]

		for (const [w, h, label] of sizes) {
			test(`${label} - normal button`, async () => {
				const { img, topBarBounds, outerBounds } = makeCanvas(w, h)
				const style = makeButtonStyle()
				const statusStyle = makeStatusStyle()
				ButtonDecorationRenderer.drawStatusBar(img, statusStyle, topBarBounds, false)
				ButtonDecorationRenderer.drawIcons(img, style, topBarBounds)
				ButtonDecorationRenderer.drawBorderWhenPushed(img, style, outerBounds)
				await expect(img.canvasImage).toMatchImageSnapshot()
			})

			test(`${label} - pushed with error status`, async () => {
				const { img, topBarBounds, outerBounds } = makeCanvas(w, h)
				const style = makeButtonStyle({ pushed: true, button_status: 'error' })
				const statusStyle = makeStatusStyle({ pushed: true })
				ButtonDecorationRenderer.drawStatusBar(img, statusStyle, topBarBounds, false)
				ButtonDecorationRenderer.drawIcons(img, style, topBarBounds)
				ButtonDecorationRenderer.drawBorderWhenPushed(img, style, outerBounds)
				await expect(img.canvasImage).toMatchImageSnapshot()
			})

			test(`${label} - pushed with action running`, async () => {
				const { img, topBarBounds, outerBounds } = makeCanvas(w, h)
				const style = makeButtonStyle({ pushed: true, action_running: true })
				const statusStyle = makeStatusStyle({ pushed: true })
				ButtonDecorationRenderer.drawStatusBar(img, statusStyle, topBarBounds, false)
				ButtonDecorationRenderer.drawIcons(img, style, topBarBounds)
				ButtonDecorationRenderer.drawBorderWhenPushed(img, style, outerBounds)
				await expect(img.canvasImage).toMatchImageSnapshot()
			})
		}
	})
})

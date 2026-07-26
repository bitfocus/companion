import { describe, expect, test } from 'vitest'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsTextDrawElement,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
	type DrawStyleLayeredButtonModel,
} from '@companion-app/shared/Model/StyleModel.js'
import { GraphicsLayeredProcessedStyleGenerator } from '../../lib/Graphics/LayeredProcessedStyleGenerator.js'

// ── element factories ──────────────────────────────────────────────────────────

const BASE = {
	usage: ButtonGraphicsElementUsage.Automatic,
	enabled: true,
	opacity: 1,
	contentHash: 'hash',
	x: 0,
	y: 0,
	width: 72,
	height: 72,
	rotation: 0,
} as const

function makeTextEl(overrides: Partial<ButtonGraphicsTextDrawElement> = {}): ButtonGraphicsTextDrawElement {
	return {
		...BASE,
		id: 'text1',
		type: 'text',
		text: 'Label',
		fontsize: 7,
		fontsizeAllowShrink: false,
		font: 'companion-sans',
		weight: 'normal',
		styles: [],
		color: 0xffffff,
		outlineColor: 0,
		halign: 'center',
		valign: 'center',
		...overrides,
	}
}

function makeBoxEl(overrides: Partial<ButtonGraphicsBoxDrawElement> = {}): ButtonGraphicsBoxDrawElement {
	return {
		...BASE,
		id: 'box1',
		type: 'box',
		color: 0x112233,
		cornerRadius: 0,
		borderWidth: 0,
		borderColor: 0,
		borderPosition: 'inside',
		...overrides,
	}
}

function makeImageEl(overrides: Partial<ButtonGraphicsImageDrawElement> = {}): ButtonGraphicsImageDrawElement {
	return {
		...BASE,
		id: 'image1',
		type: 'image',
		base64Image: null,
		halign: 'center',
		valign: 'center',
		fillMode: 'fit',
		...overrides,
	}
}

function makeCanvasEl(
	decoration: ButtonGraphicsDecorationType = ButtonGraphicsDecorationType.FollowDefault
): ButtonGraphicsCanvasDrawElement {
	return {
		id: 'canvas1',
		usage: ButtonGraphicsElementUsage.Automatic,
		contentHash: 'hash',
		type: 'canvas',
		decoration,
		showStatusIcons: ButtonGraphicsShowStatusIcons.FollowDefault,
	}
}

function makeGroupEl(
	children: SomeButtonGraphicsDrawElement[],
	overrides: Partial<ButtonGraphicsGroupDrawElement> = {}
): ButtonGraphicsGroupDrawElement {
	return {
		...BASE,
		id: 'group1',
		type: 'group',
		squareCoords: false,
		...overrides,
		children,
	}
}

function makeButtonStyle(elements: SomeButtonGraphicsDrawElement[], pushed = false): DrawStyleLayeredButtonModel {
	return {
		style: 'button-layered',
		drawType: 'button',
		elements,
		pushed,
		stepCurrent: 0,
		stepCount: 1,
		button_status: undefined,
		action_running: undefined,
	}
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('GraphicsLayeredProcessedStyleGenerator.Generate', () => {
	describe('non-button drawType passthrough', () => {
		test.each(['pagenum', 'pageup', 'pagedown'] as const)('drawType %s returns { type: %s }', (drawType) => {
			const style = { ...makeButtonStyle([]), drawType }
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(style)
			expect(result).toEqual({ type: drawType })
		})
	})

	describe('state field', () => {
		test('pushed:false is reflected in state', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.state?.pushed).toBe(false)
		})

		test('pushed:true is reflected in state', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([], true))
			expect(result.state?.pushed).toBe(true)
		})
	})

	describe('showTopBar from canvas decoration', () => {
		test('no canvas layer → showTopBar is "default"', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.state?.showTopBar).toBe('default')
		})

		test('canvas with TopBar decoration → showTopBar is true', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(
				makeButtonStyle([makeCanvasEl(ButtonGraphicsDecorationType.TopBar)])
			)
			expect(result.state?.showTopBar).toBe(true)
		})

		test('canvas with Border decoration → showTopBar is false', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(
				makeButtonStyle([makeCanvasEl(ButtonGraphicsDecorationType.Border)])
			)
			expect(result.state?.showTopBar).toBe(false)
		})

		test('canvas with FollowDefault decoration → showTopBar is "default"', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(
				makeButtonStyle([makeCanvasEl(ButtonGraphicsDecorationType.FollowDefault)])
			)
			expect(result.state?.showTopBar).toBe('default')
		})

		test('canvas with None decoration → showTopBar is "default"', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(
				makeButtonStyle([makeCanvasEl(ButtonGraphicsDecorationType.None)])
			)
			expect(result.state?.showTopBar).toBe('default')
		})
	})

	describe('text layer selection', () => {
		test('no text layer → text is undefined', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.text).toBeUndefined()
		})

		test('text layer with Text usage is selected', () => {
			const textEl = makeTextEl({ usage: ButtonGraphicsElementUsage.Text, text: 'Hi' })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([textEl]))
			expect(result.text?.text).toBe('Hi')
		})

		test('text layer with Automatic usage is used as fallback', () => {
			const textEl = makeTextEl({ usage: ButtonGraphicsElementUsage.Automatic, text: 'Fallback' })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([textEl]))
			expect(result.text?.text).toBe('Fallback')
		})

		test('text layer with Text usage is preferred over Automatic', () => {
			const autoEl = makeTextEl({ id: 'auto', usage: ButtonGraphicsElementUsage.Automatic, text: 'Auto' })
			const textEl = makeTextEl({ id: 'pref', usage: ButtonGraphicsElementUsage.Text, text: 'Preferred' })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([autoEl, textEl]))
			expect(result.text?.text).toBe('Preferred')
		})

		test('text layer with non-Text/Automatic usage is ignored', () => {
			const colorEl = makeTextEl({ usage: ButtonGraphicsElementUsage.Color })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([colorEl]))
			expect(result.text).toBeUndefined()
		})

		test('text layer inside a group is found recursively', () => {
			const textEl = makeTextEl({ usage: ButtonGraphicsElementUsage.Text, text: 'Deep' })
			const group = makeGroupEl([textEl])
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([group]))
			expect(result.text?.text).toBe('Deep')
		})

		test('text layer properties are mapped correctly', () => {
			const textEl = makeTextEl({
				usage: ButtonGraphicsElementUsage.Text,
				text: 'Mapped',
				color: 0xabcdef,
				halign: 'left',
				valign: 'bottom',
			})
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([textEl]))
			expect(result.text).toMatchObject({
				text: 'Mapped',
				color: 0xabcdef,
				halign: 'left',
				valign: 'bottom',
			})
		})
	})

	describe('box layer selection', () => {
		test('no box layer → color is undefined', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.color).toBeUndefined()
		})

		test('box layer with Color usage is selected', () => {
			const boxEl = makeBoxEl({ usage: ButtonGraphicsElementUsage.Color, color: 0x336699 })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([boxEl]))
			expect(result.color?.color).toBe(0x336699)
		})

		test('box layer with Automatic usage is used as fallback', () => {
			const boxEl = makeBoxEl({ usage: ButtonGraphicsElementUsage.Automatic, color: 0x001122 })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([boxEl]))
			expect(result.color?.color).toBe(0x001122)
		})

		test('box layer inside a group is found recursively', () => {
			const boxEl = makeBoxEl({ usage: ButtonGraphicsElementUsage.Color, color: 0xffee00 })
			const group = makeGroupEl([boxEl])
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([group]))
			expect(result.color?.color).toBe(0xffee00)
		})
	})

	describe('image layer selection', () => {
		test('no image layer → png64 is undefined', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.png64).toBeUndefined()
		})

		test('image layer with null base64Image → png64 is undefined', () => {
			const imageEl = makeImageEl({ usage: ButtonGraphicsElementUsage.Image, base64Image: null })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([imageEl]))
			expect(result.png64).toBeUndefined()
		})

		test('image layer with base64Image → png64 is set', () => {
			const imageEl = makeImageEl({
				usage: ButtonGraphicsElementUsage.Image,
				base64Image: 'data:image/png;base64,abc',
				halign: 'right',
				valign: 'top',
			})
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([imageEl]))
			expect(result.png64).toEqual({
				dataUrl: 'data:image/png;base64,abc',
				halign: 'right',
				valign: 'top',
			})
		})

		test('image layer with Automatic usage is used as fallback', () => {
			const imageEl = makeImageEl({
				usage: ButtonGraphicsElementUsage.Automatic,
				base64Image: 'data:image/png;base64,xyz',
			})
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([imageEl]))
			expect(result.png64?.dataUrl).toBe('data:image/png;base64,xyz')
		})

		test('image layer inside a group is found recursively', () => {
			const imageEl = makeImageEl({
				usage: ButtonGraphicsElementUsage.Image,
				base64Image: 'data:image/png;base64,deep',
			})
			const group = makeGroupEl([imageEl])
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([group]))
			expect(result.png64?.dataUrl).toBe('data:image/png;base64,deep')
		})
	})

	describe('downConvertFontSize (tested via text layer)', () => {
		function getFontSize(fontsize: number, allowShrink: boolean): number | 'auto' {
			const textEl = makeTextEl({ usage: ButtonGraphicsElementUsage.Text, fontsize, fontsizeAllowShrink: allowShrink })
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([textEl]))
			return result.text!.size
		}

		test('allowShrink=true returns "auto" (backward compat for modules)', () => {
			expect(getFontSize(10, true)).toBe('auto')
		})

		test('allowShrink=false: size is scaled by 0.48', () => {
			expect(getFontSize(10, false)).toBe(4.8)
		})

		test('allowShrink=false: result is rounded to 1 decimal place', () => {
			// 7 * 0.48 = 3.36
			expect(getFontSize(7, false)).toBe(3.4)
		})

		test('allowShrink=false: zero returns "auto" (fails the > 0 check)', () => {
			expect(getFontSize(0, false)).toBe('auto')
		})
	})

	describe('result type field', () => {
		test('button drawType returns type "button"', () => {
			const result = GraphicsLayeredProcessedStyleGenerator.Generate(makeButtonStyle([]))
			expect(result.type).toBe('button')
		})
	})
})

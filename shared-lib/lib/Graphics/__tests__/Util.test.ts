import { describe, expect, test } from 'vitest'
import type { ButtonGraphicsCanvasDrawElement, SomeButtonGraphicsDrawElement } from '../../Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '../../Model/StyleModel.js'
import { colorToNumber, parseColorAlpha, resolveButtonStyleProperties } from '../Util.js'

function canvasElement(
	decoration: ButtonGraphicsDecorationType,
	showStatusIcons: ButtonGraphicsShowStatusIcons
): ButtonGraphicsCanvasDrawElement {
	return {
		id: 'canvas',
		type: 'canvas',
		usage: ButtonGraphicsElementUsage.Automatic,
		contentHash: '',
		decoration,
		showStatusIcons,
	}
}

const globalTopbar = { buttons_decoration: ButtonGraphicsDecorationType.TopBar, buttons_status_icons: 'show' } as const
const globalNone = { buttons_decoration: ButtonGraphicsDecorationType.None, buttons_status_icons: 'none' } as const

describe('parseColorAlpha', () => {
	test('opaque color number has alpha 1', () => {
		expect(parseColorAlpha(0xff0000)).toBe(1)
	})

	test('color number with a transparent alpha byte has alpha 0', () => {
		expect(parseColorAlpha(0xff000000)).toBe(0) // top byte 0xff = fully transparent
	})

	test('fully transparent css string has alpha 0', () => {
		expect(parseColorAlpha('rgba(0, 0, 0, 0)')).toBe(0)
	})

	test('half-transparent css string has alpha ~0.5', () => {
		expect(parseColorAlpha('#ff000080')).toBeCloseTo(0.5, 1)
	})

	test('invalid color has alpha 0', () => {
		expect(parseColorAlpha('not-a-color')).toBe(0)
	})
})

describe('colorToNumber', () => {
	test('returns a color number unchanged', () => {
		expect(colorToNumber(0xff0000)).toBe(0xff0000)
	})

	test('coerces a numeric string to a number', () => {
		expect(colorToNumber('16777215')).toBe(16777215)
	})

	test('parses a css color string to a color number', () => {
		expect(colorToNumber('#ff0000')).toBe(0xff0000)
	})

	test('packs alpha into the top byte for a translucent css string', () => {
		expect(colorToNumber('rgba(255, 0, 0, 0.5)')).toBe(0xff0000 + 0x80 * 0x1000000)
	})

	test('returns 0 for an invalid color', () => {
		expect(colorToNumber('not-a-color')).toBe(0)
	})
})

describe('resolveButtonStyleProperties', () => {
	describe('decoration', () => {
		test('falls back to the global default when there is no canvas element', () => {
			expect(resolveButtonStyleProperties(globalTopbar, []).decoration).toBe(ButtonGraphicsDecorationType.TopBar)
			expect(resolveButtonStyleProperties(globalNone, []).decoration).toBe(ButtonGraphicsDecorationType.None)
		})

		test('uses the global default when the canvas element follows default', () => {
			const elements: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.FollowDefault, ButtonGraphicsShowStatusIcons.FollowDefault),
			]
			expect(resolveButtonStyleProperties(globalNone, elements).decoration).toBe(ButtonGraphicsDecorationType.None)
		})

		test('the canvas element overrides the global default', () => {
			const border: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.Border, ButtonGraphicsShowStatusIcons.FollowDefault),
			]
			// Global says topbar, but the button explicitly asks for a border
			expect(resolveButtonStyleProperties(globalTopbar, border).decoration).toBe(ButtonGraphicsDecorationType.Border)

			const topbar: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.TopBar, ButtonGraphicsShowStatusIcons.FollowDefault),
			]
			// Global says none, but the button explicitly asks for a topbar
			expect(resolveButtonStyleProperties(globalNone, topbar).decoration).toBe(ButtonGraphicsDecorationType.TopBar)
		})
	})

	describe('show_status_icons', () => {
		test('falls back to the global default when there is no canvas element', () => {
			expect(resolveButtonStyleProperties(globalTopbar, []).show_status_icons).toBe(true)
			expect(resolveButtonStyleProperties(globalNone, []).show_status_icons).toBe(false)
		})

		test('follow default uses the global value', () => {
			const elements: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.FollowDefault, ButtonGraphicsShowStatusIcons.FollowDefault),
			]
			expect(resolveButtonStyleProperties(globalTopbar, elements).show_status_icons).toBe(true)
			expect(resolveButtonStyleProperties(globalNone, elements).show_status_icons).toBe(false)
		})

		test('the canvas element overrides the global default', () => {
			const showAll: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.FollowDefault, ButtonGraphicsShowStatusIcons.ShowAll),
			]
			expect(resolveButtonStyleProperties(globalNone, showAll).show_status_icons).toBe(true)

			const none: SomeButtonGraphicsDrawElement[] = [
				canvasElement(ButtonGraphicsDecorationType.FollowDefault, ButtonGraphicsShowStatusIcons.None),
			]
			expect(resolveButtonStyleProperties(globalTopbar, none).show_status_icons).toBe(false)
		})
	})
})

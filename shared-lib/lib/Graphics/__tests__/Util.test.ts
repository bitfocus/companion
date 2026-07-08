import { describe, expect, test } from 'vitest'
import type { ButtonGraphicsCanvasDrawElement, SomeButtonGraphicsDrawElement } from '../../Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '../../Model/StyleModel.js'
import { resolveButtonStyleProperties } from '../Util.js'

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

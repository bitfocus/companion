import { isPrimaryModifierHeld } from '~/util/platform.js'
import type { GridButtonModifiers } from './GridButtonPreview.js'

/**
 * Whether a click with these keys held presses the button for real, whatever tool is in use - for testing a
 * button in between edits without switching to the press tool. Shift and Ctrl on their own select, and on a Mac
 * Ctrl+click is a right-click, so it is the platform's primary modifier (⌘ there) with shift.
 */
export function isTestPressGesture(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
	return e.shiftKey && isPrimaryModifierHeld(e)
}

/**
 * What the keys held while hovering mean for a click, for previewing it. The keys for a test press mean a press,
 * not a range or a toggle, so they preview neither.
 */
export function hoverModifiers(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): GridButtonModifiers {
	if (isTestPressGesture(e)) return { range: false, toggle: false }
	return { range: e.shiftKey, toggle: e.ctrlKey || e.metaKey }
}

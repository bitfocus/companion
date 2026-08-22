import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import { SelectTool } from './SelectTool.js'
import type { GridToolContext, GridToolId } from './types.js'

/**
 * Every tap adds or removes a button, with no modifier held.
 *
 * Ctrl-clicking does this on a desktop, and rubber-banding does it faster still, but neither is
 * available to a finger: a touch drag has to stay as scrolling the grid, and there is no ctrl key.
 * So the behaviour becomes a mode you enter, which works the same way with a mouse for anyone who
 * would rather not hold a chord.
 *
 * Whatever is already selected is kept, so this can be entered part-way through picking things out
 * rather than starting again.
 */
export class MultiSelectTool extends SelectTool {
	override readonly id: GridToolId = 'multi-select'

	override hint(ctx: GridToolContext): string | null {
		// Once something is selected the context bar has a count to show instead, which is more useful
		return ctx.store.selectionCount > 0 ? null : 'Tap buttons to add and remove them from the selection'
	}

	override onTap(ctx: GridToolContext, location: ControlLocation, modifiers: GridButtonModifiers): void {
		// Shift still extends a range, which is the one thing worth keeping from the modifier version
		ctx.store.selectWithModifiers(location, { range: modifiers.range, toggle: !modifiers.range })
	}
}

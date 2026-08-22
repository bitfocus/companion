import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import { GridToolBase, type GridToolContext, type GridToolId } from './types.js'

/**
 * The default tool: tapping a button selects it and opens the editor.
 */
export class SelectTool extends GridToolBase {
	readonly id: GridToolId = 'select'

	/** Dragging a box across the grid picks out a region to select */
	override allowsMarquee(_additive: boolean): boolean {
		return true
	}

	override onMarquee(ctx: GridToolContext, from: ControlLocation, to: ControlLocation, additive: boolean): void {
		ctx.store.selectRectangle(from, to, additive)
	}

	override onTap(ctx: GridToolContext, location: ControlLocation, modifiers: GridButtonModifiers): void {
		ctx.store.selectWithModifiers(location, modifiers)

		// Opening the editor for one of many would be arbitrary, so a multiple selection shows its own
		// panel instead
		if (ctx.store.selectionCount === 1) ctx.actions.openEditor(location)
	}

	override onBack(ctx: GridToolContext): boolean {
		if (ctx.store.selectionCount === 0) return false

		ctx.store.clearSelection()
		return true
	}

	override onPageChanged(ctx: GridToolContext): void {
		// A selection belongs to the page it was made on - there is nothing sensible to show for it
		// once you are looking elsewhere. Transfer tools capture their sources instead, so they are
		// the ones that survive a page change.
		ctx.store.clearSelection()
	}
}

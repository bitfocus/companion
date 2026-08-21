import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GridToolBase, type GridToolContext, type GridToolId } from './types.js'

/**
 * Tap a button to clear it, confirming first.
 *
 * Armed with several buttons selected it offers to clear those, the same way the transfer tools take
 * a deliberate multiple selection as their sources - otherwise there would be no way to clear a
 * selection by touch, where there is no delete key. A single selected button is only the one you
 * last looked at, so that goes back to picking a target by tapping.
 *
 * Nothing is destroyed without a confirmation naming the count either way.
 */
export class DeleteTool extends GridToolBase {
	readonly id: GridToolId = 'delete'

	override hint(_ctx: GridToolContext): string {
		return `Press the button you want to delete`
	}

	override onEnter(ctx: GridToolContext): void {
		const selection = ctx.store.selectedLocations
		if (selection.length > 1) ctx.actions.clearButtons([...selection])

		ctx.store.clearSelection()
	}

	override onTap(ctx: GridToolContext, location: ControlLocation): void {
		// Nothing to clear, so nothing to confirm. Asking about an empty cell is pure noise.
		if (!ctx.actions.isOccupied(location)) return

		ctx.actions.clearButtons([location])
	}
}

import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GridToolBase, type GridToolContext, type GridToolId } from './types.js'

/**
 * Tap a button to clear it, confirming first.
 *
 * Unlike the transfer tools this deliberately ignores whatever is selected when it is activated:
 * arming a destructive tool should never be the thing that destroys something. Clearing a selection
 * in one go is offered by the selection bar instead, where the count is visible at the time.
 */
export class DeleteTool extends GridToolBase {
	readonly id: GridToolId = 'delete'

	override hint(_ctx: GridToolContext): string {
		return `Press the button you want to delete`
	}

	override onEnter(ctx: GridToolContext): void {
		ctx.store.clearSelection()
	}

	override onTap(ctx: GridToolContext, location: ControlLocation): void {
		ctx.actions.clearButtons([location])
	}
}

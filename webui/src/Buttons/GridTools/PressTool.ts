import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GridToolBase, type GridToolContext, type GridToolId } from './types.js'

/**
 * Clicking a button runs it, for testing without a surface to hand.
 *
 * This used to live on the shift key, held anywhere in the app, which both burned the one modifier
 * every grid UI uses for range-select and made it far too easy to fire actions by accident. As a
 * tool it is explicit, and the grid can shout about being in it.
 */
export class PressTool extends GridToolBase {
	readonly id: GridToolId = 'press'

	override readonly pressMode = true

	override onPress(ctx: GridToolContext, location: ControlLocation, isDown: boolean): void {
		ctx.actions.press(location, isDown)
	}

	override onEnter(ctx: GridToolContext): void {
		// Nothing here acts on a selection, and leaving buttons highlighted while the grid is live
		// only muddles what is about to happen
		ctx.store.clearSelection()
	}
}

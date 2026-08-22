import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import { pendingChanges } from '../GridGeometry.js'
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
		ctx.store.selectWithModifiers(location, this.tapModifiers(modifiers))

		// Opening the editor for one of many would be arbitrary, so a multiple selection shows its own
		// panel instead
		if (ctx.store.selectionCount === 1) ctx.actions.openEditor(location)

		// The pointer has not moved, so nothing else will redraw what a click here would now do - and
		// after a ctrl-click that answer has flipped to "another one would put it back"
		this.onHover(ctx, location, modifiers)
	}

	/**
	 * What a tap on this tool means in terms of the selection.
	 *
	 * Shared with the preview, so the outline drawn under the cursor and the click that follows it
	 * are the same question asked twice rather than two separate answers.
	 */
	protected tapModifiers(modifiers: GridButtonModifiers): GridButtonModifiers {
		return modifiers
	}

	/**
	 * Show which buttons a modifier-click would add to the selection, and which it would drop.
	 *
	 * Only while a modifier is held: a plain click replaces the selection outright, and lighting up
	 * everything about to be dropped from it says far more about what is being left behind than
	 * about what is being chosen.
	 */
	override onHover(ctx: GridToolContext, location: ControlLocation | null, modifiers: GridButtonModifiers): void {
		const tapModifiers = this.tapModifiers(modifiers)
		if (!location || !(tapModifiers.range || tapModifiers.toggle)) {
			ctx.store.setPendingChanges(null)
			return
		}

		ctx.store.setPendingChanges(
			pendingChanges(ctx.store.selectedLocations, ctx.store.selectionAfter(location, tapModifiers))
		)
	}

	override onExit(ctx: GridToolContext): void {
		ctx.store.setPendingChanges(null)
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

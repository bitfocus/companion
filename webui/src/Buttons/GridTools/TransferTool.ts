import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { buildTransferPairs, locationsInRectangle, previewPlacements } from '../GridGeometry.js'
import { GridToolBase, type GridToolContext, type GridToolId, type GridTransferOperation } from './types.js'

const VERBS: Record<GridTransferOperation, string> = {
	copy: 'copy',
	move: 'move',
	swap: 'swap',
}

/**
 * Copy, move and swap: pick what to act on, then pick where it goes.
 *
 * Activated with nothing selected - or with just the one button you happen to have been looking at -
 * this is the long-standing two-tap flow, hint text and all: no modifiers, no drag precision, large
 * targets, which is still the best way to do this on a touchscreen. Only a deliberate multiple
 * selection skips the first step, so the same tool also serves "select a region, then place it".
 *
 * It stays active after each transfer rather than dropping back to select, so repeated
 * source-then-destination work does not mean re-arming the tool every time.
 */
export class TransferTool extends GridToolBase {
	readonly id: GridToolId

	readonly #operation: GridTransferOperation

	/**
	 * What is being transferred, once chosen.
	 *
	 * Held here rather than read from the selection as we go, so that changing page mid-transfer
	 * cannot lose it - that is what makes copying between pages work. While a tool holds buttons they
	 * are not selected: one or the other owns them, never both.
	 */
	#sources: ControlLocation[] | null = null

	constructor(operation: GridTransferOperation) {
		super()
		this.id = operation
		this.#operation = operation
	}

	override hint(_ctx: GridToolContext): string {
		if (!this.#sources) return `Press the button you want to ${VERBS[this.#operation]}`
		return `Where do you want it?`
	}

	override getSourceLocations(): readonly ControlLocation[] {
		return this.#sources ?? []
	}

	/** Only while it is asking what to take. Once it is asking where to put them, a box means nothing. */
	override allowsMarquee(): boolean {
		return this.#sources === null
	}

	override onMarquee(ctx: GridToolContext, from: ControlLocation, to: ControlLocation): void {
		const region = locationsInRectangle(from, to)

		// The gaps in a region are part of its shape and travel with it, but a box containing nothing
		// at all is a stray drag rather than a choice
		if (!region.some((location) => ctx.actions.isOccupied(location))) return

		this.#sources = region
		ctx.store.notifyToolChanged()
	}

	override onEnter(ctx: GridToolContext): void {
		// Only a deliberate multiple selection is taken as "these are what I want to move". A single
		// selected button is just the one you last looked at - clicking a button to see it selects it -
		// so treating that as the source would silently make your first tap the destination.
		const selection = ctx.store.selectedLocations
		if (selection.length <= 1) return

		// Picked up, not selected. Leaving them selected as well means two copies of the same thing,
		// and anything that clears one - deselecting, say - leaves the other behind still holding them.
		this.#sources = [...selection]
		ctx.store.clearSelection()
	}

	override onTap(ctx: GridToolContext, location: ControlLocation): void {
		if (!this.#sources) {
			// Copying or moving an empty cell has nothing to carry, and would quietly wipe whatever it
			// was dropped on. A swap is symmetric - trading with an empty cell is how you move a button
			// into one - so it accepts either end.
			if (this.#operation !== 'swap' && !ctx.actions.isOccupied(location)) return

			this.#sources = [location]
			ctx.store.notifyToolChanged()
			return
		}

		const pairs = buildTransferPairs(this.#sources, location)

		// A region that would hang off the grid is refused outright rather than placing the part of it
		// that happens to fit and losing the rest somewhere unreachable. The tool keeps hold of the
		// buttons, so the only cost is another tap somewhere with more room - and with a pointer the
		// ghost has already been showing this as refused.
		if (!ctx.actions.fitsOnGrid(pairs.map((pair) => pair.toLocation))) return

		// The selection is left to follow the buttons to their destination, which `transfer` handles
		ctx.actions.transfer(this.#operation, pairs)

		// Ready for the next one
		this.#sources = null
		ctx.store.setDragPreview(null)
		ctx.store.notifyToolChanged()
	}

	/**
	 * Show where the region would land if it were placed here.
	 *
	 * The buttons are anchored by the top-left of what was picked up, which is not something anyone
	 * can work out from a box they dragged bottom-up - so it is drawn instead of left to be guessed
	 * at. It also means the click that commits the move is never the first sign of what it does.
	 */
	override onHover(ctx: GridToolContext, location: ControlLocation | null): void {
		if (!this.#sources) return

		if (!location) {
			ctx.store.setDragPreview(null)
			return
		}

		const pairs = buildTransferPairs(this.#sources, location)
		ctx.store.setDragPreview({
			placements: previewPlacements(this.#operation, pairs),
			valid: ctx.actions.fitsOnGrid(pairs.map((pair) => pair.toLocation)),
		})
	}

	override onExit(ctx: GridToolContext): void {
		this.#sources = null
		ctx.store.setDragPreview(null)
	}

	override onBack(ctx: GridToolContext): boolean {
		if (!this.#sources) return false

		// Put them back where they came from rather than dropping them entirely. Backing out of a
		// misclicked tool should not cost you the selection you built up to use it.
		const released = this.#sources
		this.#sources = null
		ctx.store.setDragPreview(null)
		ctx.store.setSelection(released)
		return true
	}
}

import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	GridToolBase,
	type GridToolContext,
	type GridToolId,
	type GridTransferOperation,
	type GridTransferPair,
} from './types.js'

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

	override onExit(_ctx: GridToolContext): void {
		this.#sources = null
	}

	override onTap(ctx: GridToolContext, location: ControlLocation): void {
		if (!this.#sources) {
			this.#sources = [location]
			ctx.store.notifyToolChanged()
			return
		}

		// The selection is left to follow the buttons to their destination, which `transfer` handles
		ctx.actions.transfer(this.#operation, buildTransferPairs(this.#sources, location))

		// Ready for the next one
		this.#sources = null
		ctx.store.notifyToolChanged()
	}

	override onBack(ctx: GridToolContext): boolean {
		if (!this.#sources) return false

		// Put them back where they came from rather than dropping them entirely. Backing out of a
		// misclicked tool should not cost you the selection you built up to use it.
		const released = this.#sources
		this.#sources = null
		ctx.store.setSelection(released)
		return true
	}
}

/**
 * Map each source onto the destination, anchoring the top-left of the sources' bounding box at the
 * tapped cell. A single source therefore lands exactly where it was dropped, and a region keeps its
 * shape.
 */
export function buildTransferPairs(sources: ControlLocation[], destination: ControlLocation): GridTransferPair[] {
	const minRow = Math.min(...sources.map((l) => l.row))
	const minColumn = Math.min(...sources.map((l) => l.column))

	return sources.map((fromLocation) => ({
		fromLocation,
		toLocation: {
			pageNumber: destination.pageNumber,
			row: destination.row + (fromLocation.row - minRow),
			column: destination.column + (fromLocation.column - minColumn),
		},
	}))
}

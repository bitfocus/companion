import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'
import { buildTransferPairs, locationsInRectangle, previewPlacements, withoutEmptySources } from '../GridGeometry.js'
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

	/**
	 * The cell a shift-click measures its rectangle from - wherever picking these buttons up started.
	 * Kept alongside the sources rather than using the store's, which belongs to the selection the
	 * tool has just taken these out of.
	 */
	#rangeAnchor: ControlLocation | null = null

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

	/**
	 * A plain box while it is asking what to take. Once it is holding buttons only an additive one,
	 * which adds to them - a stray drag then means nothing, rather than silently replacing the
	 * selection that was built up to be placed.
	 */
	override allowsMarquee(additive: boolean): boolean {
		return this.#sources === null || additive
	}

	override onMarquee(ctx: GridToolContext, from: ControlLocation, to: ControlLocation, additive: boolean): void {
		const region = locationsInRectangle(from, to)

		// The gaps in a region are part of its shape - they set where the buttons around them land, and
		// place nothing of their own - but a box containing nothing at all is a stray drag, not a choice
		if (!region.some((location) => ctx.actions.isOccupied(location))) return

		if (additive && this.#sources) {
			const held = new Set(this.#sources.map(formatLocation))
			this.#sources = [...this.#sources, ...region.filter((location) => !held.has(formatLocation(location)))]
		} else {
			this.#sources = region
			this.#rangeAnchor = from
		}

		// Whatever was drawn for the old set is now wrong
		ctx.store.setDragPreview(null)
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
		this.#rangeAnchor = selection[0]
		ctx.store.clearSelection()
	}

	override onTap(ctx: GridToolContext, location: ControlLocation, modifiers: GridButtonModifiers): void {
		if (!this.#sources) {
			// Copying or moving an empty cell has nothing to carry, and would quietly wipe whatever it
			// was dropped on. A swap is symmetric - trading with an empty cell is how you move a button
			// into one - so it accepts either end.
			if (this.#operation !== 'swap' && !ctx.actions.isOccupied(location)) return

			// Nothing to extend or toggle against yet, so a modifier just starts the set off
			this.#sources = [location]
			this.#rangeAnchor = location
			ctx.store.notifyToolChanged()
			return
		}

		// Getting the selection wrong should not mean starting the tool again. The same modifiers that
		// built it still work on it, so a stray button can be dropped from what is in hand, or a
		// forgotten row added, without putting anything down first.
		if (modifiers.range || modifiers.toggle) {
			this.#reviseSources(ctx, location, modifiers)
			return
		}

		const pairs = this.#pairsFor(ctx, location)

		// A region that would hang off the grid is refused outright rather than placing the part of it
		// that happens to fit and losing the rest somewhere unreachable. The tool keeps hold of the
		// buttons, so the only cost is another tap somewhere with more room - and with a pointer the
		// ghost has already been showing this as refused.
		if (!ctx.actions.fitsOnGrid(pairs.map((pair) => pair.toLocation))) return

		// Only once it has actually happened. Overwriting asks first, and backing out of that question
		// should leave the buttons still in hand rather than dropped somewhere unasked for.
		//
		// The selection is left to follow the buttons to their destination, which `transfer` handles
		ctx.actions.transfer(this.#operation, pairs, () => {
			// Ready for the next one
			this.#sources = null
			this.#rangeAnchor = null
			ctx.store.setDragPreview(null)
			ctx.store.notifyToolChanged()
		})
	}

	/** Shift extends from where the pick started, ctrl/cmd takes one button in or out */
	#reviseSources(ctx: GridToolContext, location: ControlLocation, modifiers: GridButtonModifiers): void {
		const current = this.#sources ?? []

		let revised: ControlLocation[]
		if (modifiers.range && this.#rangeAnchor) {
			revised = locationsInRectangle(this.#rangeAnchor, location)
		} else {
			const key = formatLocation(location)
			revised = current.some((held) => formatLocation(held) === key)
				? current.filter((held) => formatLocation(held) !== key)
				: [...current, location]
		}

		// Emptied out entirely - back to asking what to take, rather than holding nothing and still
		// claiming to be waiting for a destination
		this.#sources = revised.length > 0 ? revised : null
		if (!this.#sources) this.#rangeAnchor = null

		// What was in hand has changed, so anything drawn for the old set is now wrong
		ctx.store.setDragPreview(null)
		ctx.store.notifyToolChanged()
	}

	/**
	 * Where each button would go, minus the gaps in the region.
	 *
	 * The gaps still decide where everything lands - they are part of the shape that was picked up -
	 * but they have nothing of their own to place, so they are not shown as destinations and cannot
	 * be counted as overwriting anything.
	 */
	#pairsFor(ctx: GridToolContext, location: ControlLocation) {
		return withoutEmptySources(
			this.#operation,
			// Centred, because the ghost draws the answer under the cursor as it moves - "put it here"
			// needs no rule, where "its top-left corner goes here" does
			buildTransferPairs(this.#sources ?? [], location, 'center'),
			ctx.actions.isOccupied
		)
	}

	/**
	 * Show where the region would land if it were placed here.
	 *
	 * Drawn rather than left to be worked out: which cell a region is anchored by is not something
	 * anyone can guess from a box they dragged bottom-up. It also means the click that commits the
	 * move is never the first sign of what it does.
	 *
	 * With a modifier held the next click revises what is in hand instead of placing it, so there is
	 * no landing spot to show and drawing one would be a lie.
	 */
	override onHover(ctx: GridToolContext, location: ControlLocation | null, modifiers: GridButtonModifiers): void {
		if (!this.#sources) return

		if (!location || modifiers.range || modifiers.toggle) {
			ctx.store.setDragPreview(null)
			return
		}

		const pairs = this.#pairsFor(ctx, location)
		ctx.store.setDragPreview({
			placements: previewPlacements(this.#operation, pairs),
			valid: ctx.actions.fitsOnGrid(pairs.map((pair) => pair.toLocation)),
		})
	}

	override onExit(ctx: GridToolContext): void {
		this.#sources = null
		this.#rangeAnchor = null
		ctx.store.setDragPreview(null)
	}

	override onBack(ctx: GridToolContext): boolean {
		if (!this.#sources) return false

		// Put them back where they came from rather than dropping them entirely. Backing out of a
		// misclicked tool should not cost you the selection you built up to use it.
		const released = this.#sources
		this.#sources = null
		this.#rangeAnchor = null
		ctx.store.setDragPreview(null)
		ctx.store.setSelection(released)
		return true
	}
}

import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ButtonGridStore } from '../ButtonGridStore.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'

export type GridToolId = 'select' | 'multi-select' | 'press' | 'arrange' | 'copy' | 'move' | 'swap' | 'delete'

/** The operations that move button content from one place to another */
export type GridTransferOperation = 'copy' | 'move' | 'swap'

export interface GridTransferPair {
	fromLocation: ControlLocation
	toLocation: ControlLocation
}

/**
 * The things a tool can make happen. Deliberately not held by the store - they are passed in at the
 * moment of use, so a tool can never act through a stale callback.
 */
export interface GridToolActions {
	openEditor: (location: ControlLocation) => void
	press: (location: ControlLocation, isDown: boolean) => void
	/**
	 * Move buttons about. Refuses a placement that would fall off the grid and asks before replacing
	 * anything, so `onApplied` runs only once the transfer has actually been sent.
	 */
	transfer: (operation: GridTransferOperation, pairs: GridTransferPair[], onApplied: () => void) => void
	/** Asks the user to confirm, then clears */
	clearButtons: (locations: ControlLocation[]) => void
	/** Whether there is a button here at all */
	isOccupied: (location: ControlLocation) => boolean
	/** Place whatever is on the clipboard here, warning first if that would cost anything */
	pasteAt: (location: ControlLocation) => void
	/** Whether every one of these lands on the grid, rather than off the edge of it */
	fitsOnGrid: (locations: ControlLocation[]) => boolean
}

export interface GridToolContext {
	readonly store: ButtonGridStore
	readonly actions: GridToolActions
}

/**
 * One interaction mode of the grid. Exactly one is active at a time, and it alone decides what a tap
 * means.
 *
 * Tools are objects rather than a flag on the store so that each can own its own sequence of phases.
 * "Back" means something different for each - a two-phase transfer unwinds to its source step, while
 * select just drops what is selected - and expressing that as a method beats a growing pile of
 * conditionals at the call site.
 */
export interface GridTool {
	readonly id: GridToolId

	/** What to tell the user right now, or null when the tool has nothing to say */
	hint(ctx: GridToolContext): string | null

	/** Whether taps fire buttons for real rather than being interpreted */
	readonly pressMode: boolean

	/** Whether any button can be dragged, rather than only ones that are already selected */
	readonly dragAnyButton: boolean

	/**
	 * Which set this tool's pending changes would join, so they can be drawn in that set's colour.
	 *
	 * A dashed outline says "about to change"; the colour says what it is about to become part of,
	 * matching the solid outline already on the buttons that are there.
	 */
	readonly pendingChangesJoin: 'selection' | 'held-buttons'

	/**
	 * Whether dragging a box across the grid means anything right now.
	 *
	 * A method rather than a flag because it depends on where the tool has got to, and on what is
	 * held: a transfer wants a box while it is asking which buttons to take, and once it is asking
	 * where to put them only an additive one, which can add to what it is holding but never replace
	 * it by accident.
	 *
	 * Asked as the drag starts, so a box that would mean nothing is never drawn in the first place.
	 */
	allowsMarquee(additive: boolean): boolean

	/** A box was dragged out across the grid. What that picks is up to the tool. */
	onMarquee(ctx: GridToolContext, from: ControlLocation, to: ControlLocation, additive: boolean): void

	/**
	 * The pointer moved over this cell, or left the grid entirely.
	 *
	 * A tool that is about to place something uses this to show where it would go, so that is visible
	 * before the click rather than after it. The modifiers come along because they can change what
	 * the click would do, and so what there is to show.
	 */
	onHover(ctx: GridToolContext, location: ControlLocation | null, modifiers: GridButtonModifiers): void

	/** Buttons this tool has picked up and is about to act on, so the grid can mark them */
	getSourceLocations(): readonly ControlLocation[]

	/**
	 * @param carriedOver what the tool being replaced had picked up and not yet put down, so changing
	 * your mind about which tool should act on them does not cost you the picking
	 */
	onEnter(ctx: GridToolContext, carriedOver: readonly ControlLocation[]): void
	onExit(ctx: GridToolContext): void

	onTap(ctx: GridToolContext, location: ControlLocation, modifiers: GridButtonModifiers): void
	onPress(ctx: GridToolContext, location: ControlLocation, isDown: boolean): void

	/**
	 * Unwind one step. Returning false means there was nothing left to unwind, and the grid should
	 * fall back to the default tool.
	 */
	onBack(ctx: GridToolContext): boolean

	onPageChanged(ctx: GridToolContext, pageNumber: number): void
}

/** Shared no-op behaviour, so each tool only writes the parts it actually cares about */
export abstract class GridToolBase implements GridTool {
	abstract readonly id: GridToolId

	readonly pressMode: boolean = false
	readonly dragAnyButton: boolean = false
	readonly pendingChangesJoin: 'selection' | 'held-buttons' = 'selection'

	hint(_ctx: GridToolContext): string | null {
		return null
	}

	getSourceLocations(): readonly ControlLocation[] {
		return []
	}

	allowsMarquee(_additive: boolean): boolean {
		return false
	}

	onMarquee(_ctx: GridToolContext, _from: ControlLocation, _to: ControlLocation, _additive: boolean): void {
		// nothing by default
	}

	onHover(_ctx: GridToolContext, _location: ControlLocation | null, _modifiers: GridButtonModifiers): void {
		// nothing by default
	}

	onEnter(ctx: GridToolContext, carriedOver: readonly ControlLocation[]): void {
		// Handed back as a selection rather than dropped: a tool that has no use for buttons in hand
		// should still not be where a set you built up quietly disappears
		if (carriedOver.length > 0) ctx.store.setSelection([...carriedOver])
	}

	onExit(_ctx: GridToolContext): void {
		// nothing by default
	}

	onTap(_ctx: GridToolContext, _location: ControlLocation, _modifiers: GridButtonModifiers): void {
		// nothing by default
	}

	onPress(_ctx: GridToolContext, _location: ControlLocation, _isDown: boolean): void {
		// nothing by default
	}

	onBack(_ctx: GridToolContext): boolean {
		return false
	}

	onPageChanged(_ctx: GridToolContext, _pageNumber: number): void {
		// A tool keeps working across a page change by default - copying between pages depends on it
	}
}

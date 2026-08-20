import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ButtonGridStore } from '../ButtonGridStore.js'
import type { GridButtonModifiers } from '../GridButtonPreview.js'

export type GridToolId = 'select' | 'press' | 'arrange' | 'copy' | 'move' | 'swap' | 'delete'

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
	transfer: (operation: GridTransferOperation, pairs: GridTransferPair[]) => void
	/** Asks the user to confirm, then clears */
	clearButtons: (locations: ControlLocation[]) => void
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

	/** Buttons this tool has picked up and is about to act on, so the grid can mark them */
	getSourceLocations(): readonly ControlLocation[]

	onEnter(ctx: GridToolContext): void
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

	hint(_ctx: GridToolContext): string | null {
		return null
	}

	getSourceLocations(): readonly ControlLocation[] {
		return []
	}

	onEnter(_ctx: GridToolContext): void {
		// nothing by default
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

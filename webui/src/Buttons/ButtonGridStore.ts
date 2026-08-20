import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GridButtonModifiers } from './GridButtonPreview.js'
import {
	createGridTool,
	DEFAULT_GRID_TOOL_ID,
	type GridTool,
	type GridToolActions,
	type GridToolContext,
	type GridToolId,
} from './GridTools/index.js'

/**
 * Interaction state for one grid: what is selected, and which tool is active.
 *
 * Deliberately per grid instance rather than app-wide. Two grids showing different pages side by
 * side each need their own selection and their own in-flight tool, and hanging this off the root
 * store would rule that out.
 *
 * Built on plain subscriptions rather than mobx so that consumers can use `useSyncExternalStore`.
 * Grid cells ask only whether they themselves are selected, which is a boolean, so React's identity
 * check drops the re-render for every cell except the ones that actually changed.
 */
export class ButtonGridStore {
	readonly #listeners = new Set<() => void>()

	/** Keys are `formatLocation()` - a location object would never match by identity */
	#selectionKeys = new Set<string>()
	/** Kept alongside the key set so consumers get a stable array to read */
	#selectionLocations: readonly ControlLocation[] = []

	/** Where the keyboard is, which is not always the whole of what is selected */
	#focus: ControlLocation | null = null
	/** Where a shift-extended range measures from */
	#rangeAnchor: ControlLocation | null = null

	#activeTool: GridTool = createGridTool(DEFAULT_GRID_TOOL_ID)

	/** Locations the active tool or the clipboard has picked up, so a cell can check itself in one lookup */
	#transferSourceKeys = new Set<string>()

	#clipboard: GridClipboard | null = null

	subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener)
		return () => {
			this.#listeners.delete(listener)
		}
	}

	#notify(): void {
		// Both a tool mid-transfer and a pending cut/copy mark their sources the same way, because to
		// the user they are the same thing: buttons that have been picked up and not yet put down
		this.#transferSourceKeys = new Set(
			[...this.#activeTool.getSourceLocations(), ...(this.#clipboard?.locations ?? [])].map(formatLocation)
		)

		for (const listener of this.#listeners) listener()
	}

	/** For a tool to announce that its own phase changed, when the selection did not */
	notifyToolChanged = (): void => {
		this.#notify()
	}

	get activeTool(): GridTool {
		return this.#activeTool
	}

	get activeToolId(): GridToolId {
		return this.#activeTool.id
	}

	get pressMode(): boolean {
		return this.#activeTool.pressMode
	}

	get selectedLocations(): readonly ControlLocation[] {
		return this.#selectionLocations
	}

	get selectionCount(): number {
		return this.#selectionLocations.length
	}

	get focus(): ControlLocation | null {
		return this.#focus
	}

	/** The page the current selection lives on, or null when nothing is selected */
	get selectionPageNumber(): number | null {
		return this.#selectionLocations[0]?.pageNumber ?? null
	}

	isSelected(locationKey: string): boolean {
		return this.#selectionKeys.has(locationKey)
	}

	/** Whether the active tool has picked this button up and is waiting to place it */
	isTransferSource(locationKey: string): boolean {
		return this.#transferSourceKeys.has(locationKey)
	}

	// ---- selection ----

	#applySelection(locations: readonly ControlLocation[]): void {
		this.#selectionLocations = locations
		this.#selectionKeys = new Set(locations.map(formatLocation))
		this.#notify()
	}

	setSelection(locations: readonly ControlLocation[]): void {
		this.#applySelection([...locations])
		this.#focus = locations[locations.length - 1] ?? null
		this.#rangeAnchor = this.#focus
	}

	clearSelection(): void {
		if (this.#selectionLocations.length === 0 && !this.#focus) return

		this.#focus = null
		this.#rangeAnchor = null
		this.#applySelection([])
	}

	/**
	 * Apply a click to the selection, honouring the modifiers held at the time.
	 *
	 * Shift extends a rectangle from the anchor and ctrl/cmd toggles a single cell, matching how
	 * every file manager and grid editor behaves. Shift is only free to mean this because hot
	 * pressing moved to its own tool.
	 */
	selectWithModifiers(location: ControlLocation, modifiers: GridButtonModifiers): void {
		const key = formatLocation(location)

		// A selection only ever spans one page, so reaching another page starts again
		const crossesPages = this.selectionPageNumber !== null && this.selectionPageNumber !== location.pageNumber

		if (modifiers.range && this.#rangeAnchor && !crossesPages) {
			this.#focus = location
			this.#applySelection(locationsInRectangle(this.#rangeAnchor, location))
			return
		}

		if (modifiers.toggle && !crossesPages) {
			const next = this.#selectionKeys.has(key)
				? this.#selectionLocations.filter((l) => formatLocation(l) !== key)
				: [...this.#selectionLocations, location]

			this.#focus = location
			this.#rangeAnchor = location
			this.#applySelection(next)
			return
		}

		this.#focus = location
		this.#rangeAnchor = location
		this.#applySelection([location])
	}

	// ---- tools ----

	#context(actions: GridToolActions): GridToolContext {
		return { store: this, actions }
	}

	setTool(id: GridToolId, actions: GridToolActions): void {
		if (this.#activeTool.id === id) return

		const ctx = this.#context(actions)
		this.#activeTool.onExit(ctx)
		this.#activeTool = createGridTool(id)
		this.#activeTool.onEnter(this.#context(actions))
		this.#notify()
	}

	handleTap(location: ControlLocation, modifiers: GridButtonModifiers, actions: GridToolActions): void {
		this.#activeTool.onTap(this.#context(actions), location, modifiers)
	}

	handlePress(location: ControlLocation, isDown: boolean, actions: GridToolActions): void {
		this.#activeTool.onPress(this.#context(actions), location, isDown)
	}

	/**
	 * Unwind one step of whatever is in progress. Once the active tool has nothing left to undo, fall
	 * back to select - so escape is always "one step back, then out", never a jump to somewhere
	 * unexpected.
	 */
	goBack(actions: GridToolActions): void {
		if (this.#activeTool.onBack(this.#context(actions))) return

		this.setTool(DEFAULT_GRID_TOOL_ID, actions)
	}

	/** The grid is now showing a different page */
	setViewPage(pageNumber: number, actions: GridToolActions): void {
		this.#activeTool.onPageChanged(this.#context(actions), pageNumber)
	}

	hint(actions: GridToolActions): string | null {
		return this.#activeTool.hint(this.#context(actions))
	}

	// ---- clipboard ----

	get clipboard(): GridClipboard | null {
		return this.#clipboard
	}

	setClipboard(locations: readonly ControlLocation[], mode: GridClipboardMode): void {
		this.#clipboard = { locations: [...locations], mode }
		this.#notify()
	}

	clearClipboard(): void {
		if (!this.#clipboard) return

		this.#clipboard = null
		this.#notify()
	}

	/**
	 * Select every cell in a rectangle, as dragged out on the grid. Additive keeps whatever was
	 * already selected, for building up a selection in several sweeps.
	 */
	selectRectangle(from: ControlLocation, to: ControlLocation, additive: boolean): void {
		const rectangle = locationsInRectangle(from, to)

		const keepExisting = additive && (this.selectionPageNumber === null || this.selectionPageNumber === to.pageNumber)
		const existing = keepExisting ? this.#selectionLocations : []

		const merged = [...existing]
		const seen = new Set(existing.map(formatLocation))
		for (const location of rectangle) {
			const key = formatLocation(location)
			if (seen.has(key)) continue

			seen.add(key)
			merged.push(location)
		}

		this.#focus = to
		this.#rangeAnchor = from
		this.#applySelection(merged)
	}

	// ---- keyboard navigation ----

	#nextFocus(rowDelta: number, columnDelta: number, gridSize: UserConfigGridSize): ControlLocation | null {
		const from = this.#focus
		if (!from) return null

		return {
			pageNumber: from.pageNumber,
			row: wrap(from.row + rowDelta, gridSize.minRow, gridSize.maxRow),
			column: wrap(from.column + columnDelta, gridSize.minColumn, gridSize.maxColumn),
		}
	}

	/**
	 * Move the focus by one cell, wrapping at the edges of the grid, and select where it lands.
	 * Returns the new focus so the caller can scroll it into view.
	 */
	moveFocus(rowDelta: number, columnDelta: number, gridSize: UserConfigGridSize): ControlLocation | null {
		const next = this.#nextFocus(rowDelta, columnDelta, gridSize)
		if (!next) return null

		this.#focus = next
		this.#rangeAnchor = next
		this.#applySelection([next])

		return next
	}

	/** Move the focus, extending the selection from the anchor as it goes - shift with the arrows */
	extendFocus(rowDelta: number, columnDelta: number, gridSize: UserConfigGridSize): ControlLocation | null {
		const next = this.#nextFocus(rowDelta, columnDelta, gridSize)
		if (!next || !this.#rangeAnchor) return null

		this.#focus = next
		this.#applySelection(locationsInRectangle(this.#rangeAnchor, next))

		return next
	}

	/** Move the focus without disturbing the selection, so cells can be picked out one at a time */
	moveFocusOnly(rowDelta: number, columnDelta: number, gridSize: UserConfigGridSize): ControlLocation | null {
		const next = this.#nextFocus(rowDelta, columnDelta, gridSize)
		if (!next) return null

		this.#focus = next
		this.#notify()

		return next
	}

	/** Add or remove the focused cell, for building a selection from the keyboard */
	toggleFocused(): void {
		const focus = this.#focus
		if (!focus) return

		this.selectWithModifiers(focus, { range: false, toggle: true })
		// selectWithModifiers moves the anchor to the toggled cell, but the focus should not jump
		this.#focus = focus
	}

	selectAllOnPage(pageNumber: number, gridSize: UserConfigGridSize): void {
		const from: ControlLocation = { pageNumber, row: gridSize.minRow, column: gridSize.minColumn }
		const to: ControlLocation = { pageNumber, row: gridSize.maxRow, column: gridSize.maxColumn }

		this.#focus = to
		this.#rangeAnchor = from
		this.#applySelection(locationsInRectangle(from, to))
	}

	/** Move the focus onto another page, keeping the same cell */
	moveFocusToPage(pageNumber: number): ControlLocation | null {
		const from = this.#focus
		if (!from) return null

		const next: ControlLocation = { ...from, pageNumber }

		this.#focus = next
		this.#rangeAnchor = next
		this.#applySelection([next])

		return next
	}
}

export type GridClipboardMode = 'copy' | 'cut'

export interface GridClipboard {
	locations: ControlLocation[]
	mode: GridClipboardMode
}

function wrap(value: number, min: number, max: number): number {
	if (value < min) return max
	if (value > max) return min
	return value
}

/** Every cell in the rectangle with these two locations at opposite corners */
export function locationsInRectangle(from: ControlLocation, to: ControlLocation): ControlLocation[] {
	const minRow = Math.min(from.row, to.row)
	const maxRow = Math.max(from.row, to.row)
	const minColumn = Math.min(from.column, to.column)
	const maxColumn = Math.max(from.column, to.column)

	const locations: ControlLocation[] = []
	for (let row = minRow; row <= maxRow; row++) {
		for (let column = minColumn; column <= maxColumn; column++) {
			locations.push({ pageNumber: to.pageNumber, row, column })
		}
	}
	return locations
}

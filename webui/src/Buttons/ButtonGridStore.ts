import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GridButtonModifiers } from './GridButtonPreview.js'
import { locationsInRectangle, type GridPendingChange } from './GridGeometry.js'
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

	/** What a modifier-click would do to each cell it would touch, while the modifier is held */
	#pendingChanges = new Map<string, GridPendingChange>()

	#clipboard: GridClipboard | null = null

	#dragPreview: GridDragPreview | null = null

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

	get dragAnyButton(): boolean {
		return this.#activeTool.dragAnyButton
	}

	/**
	 * Whether a box dragged out with these modifiers held means anything to the active tool.
	 *
	 * Bound, and asked at the moment the drag starts rather than subscribed to, so the grid does not
	 * re-render every time a tool moves between its phases.
	 */
	allowsMarquee = (additive: boolean): boolean => {
		return this.#activeTool.allowsMarquee(additive)
	}

	get pendingChangesJoin(): 'selection' | 'held-buttons' {
		return this.#activeTool.pendingChangesJoin
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

	/** Everything picked up and not yet put down, by key */
	get transferSourceKeys(): ReadonlySet<string> {
		return this.#transferSourceKeys
	}

	// ---- pending changes ----

	/**
	 * What a modifier-click would do to this cell, drawn while the modifier is held.
	 *
	 * The landing ghost goes quiet under a modifier, because the click would revise what is in hand
	 * rather than place it. This is the same answer to the same question, for what the click would
	 * actually do: a rectangle measured from an anchor you cannot see is guesswork, and so is whether
	 * ctrl on a given cell means taking it or putting it back.
	 */
	pendingChange(locationKey: string): GridPendingChange | null {
		return this.#pendingChanges.get(locationKey) ?? null
	}

	setPendingChanges(changes: ReadonlyMap<string, GridPendingChange> | null): void {
		const next = changes ?? EMPTY_PENDING_CHANGES

		// Fires on every pointer move with a modifier held, so don't wake every cell for the same answer
		if (
			next.size === this.#pendingChanges.size &&
			[...next].every(([key, kind]) => this.#pendingChanges.get(key) === kind)
		) {
			return
		}

		this.#pendingChanges = new Map(next)
		this.#notify()
	}

	// ---- drag preview ----

	/**
	 * What the grid would look like if the drag were released now.
	 *
	 * Keyed by the cell that changes, with the button that would end up there. Marking the cells is
	 * not enough on its own - lining a large block up means seeing which button lands where, not just
	 * that something does - and a swap changes two places at once, so both are described.
	 */
	get dragPreview(): GridDragPreview | null {
		return this.#dragPreview
	}

	setDragPreview(preview: GridDragPreview | null): void {
		// Fires on every pointer move during a drag, so don't wake every cell up for an unchanged answer
		if (this.#dragPreview === preview) return
		if (
			this.#dragPreview &&
			preview &&
			this.#dragPreview.valid === preview.valid &&
			this.#dragPreview.placements.size === preview.placements.size &&
			[...preview.placements].every(
				([key, from]) => formatLocation(this.#dragPreview?.placements.get(key) ?? NOWHERE) === formatLocation(from)
			)
		) {
			return
		}

		this.#dragPreview = preview
		this.#notify()
	}

	/** The button that would end up on this cell, or null if nothing is heading here */
	dropGhostSource(locationKey: string): ControlLocation | null {
		return this.#dragPreview?.placements.get(locationKey) ?? null
	}

	get dragPreviewValid(): boolean {
		return this.#dragPreview?.valid ?? true
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
	/**
	 * What the selection would become if this cell were clicked with these modifiers.
	 *
	 * Pure, and shared with the preview drawn while a modifier is held, so what is shown and what the
	 * click then does cannot be worked out two different ways.
	 */
	selectionAfter(location: ControlLocation, modifiers: GridButtonModifiers): ControlLocation[] {
		const key = formatLocation(location)

		// A selection only ever spans one page, so reaching another page starts again
		const crossesPages = this.selectionPageNumber !== null && this.selectionPageNumber !== location.pageNumber

		if (modifiers.range && this.#rangeAnchor && !crossesPages) {
			return locationsInRectangle(this.#rangeAnchor, location)
		}

		if (modifiers.toggle && !crossesPages) {
			return this.#selectionKeys.has(key)
				? this.#selectionLocations.filter((l) => formatLocation(l) !== key)
				: [...this.#selectionLocations, location]
		}

		return [location]
	}

	selectWithModifiers(location: ControlLocation, modifiers: GridButtonModifiers): void {
		// Worked out before the anchor moves, since a range measures from it
		const next = this.selectionAfter(location, modifiers)

		const crossesPages = this.selectionPageNumber !== null && this.selectionPageNumber !== location.pageNumber
		const extendsRange = modifiers.range && !!this.#rangeAnchor && !crossesPages

		this.#focus = location
		// A range keeps measuring from where it started; anything else starts measuring from here
		if (!extendsRange) this.#rangeAnchor = location
		this.#applySelection(next)
	}

	// ---- tools ----

	#context(actions: GridToolActions): GridToolContext {
		return { store: this, actions }
	}

	setTool(id: GridToolId, actions: GridToolActions): void {
		if (this.#activeTool.id === id) return

		const ctx = this.#context(actions)
		// Read before the outgoing tool is asked to let go, so switching between copy, move and swap
		// after picking the buttons is a change of mind rather than a fresh start
		const carriedOver = [...this.#activeTool.getSourceLocations()]

		this.#activeTool.onExit(ctx)
		// Whatever the last tool was drawing under the cursor is its business, not the next one's
		this.setPendingChanges(null)
		this.#activeTool = createGridTool(id)
		this.#activeTool.onEnter(this.#context(actions), carriedOver)
		this.#notify()
	}

	handleTap(location: ControlLocation, modifiers: GridButtonModifiers, actions: GridToolActions): void {
		this.#activeTool.onTap(this.#context(actions), location, modifiers)
	}

	/** The pointer moved over a cell, or left the grid. Tools use it to preview what a click would do. */
	handleHover(location: ControlLocation | null, modifiers: GridButtonModifiers, actions: GridToolActions): void {
		this.#activeTool.onHover(this.#context(actions), location, modifiers)
	}

	/** A box was dragged out across the grid. What it picks depends on the tool. */
	handleMarquee(from: ControlLocation, to: ControlLocation, additive: boolean, actions: GridToolActions): void {
		this.#activeTool.onMarquee(this.#context(actions), from, to, additive)
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

		// A pending cut or copy is every bit as much "something in progress" as a half-finished tool -
		// it holds buttons, it marks them on the grid, and until this it had no way out at all
		if (this.#clipboard) {
			this.clearClipboard()
			return
		}

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

export interface GridDragPreview {
	/** Cell key -> where the button that would end up there is coming from */
	placements: Map<string, ControlLocation>
	/** False when the region would hang off the grid, so releasing would do nothing */
	valid: boolean
}

/** Stands in for "no location" when comparing two previews, so neither side needs a null check */
const NOWHERE: ControlLocation = { pageNumber: -1, row: -1, column: -1 }

const EMPTY_PENDING_CHANGES: ReadonlyMap<string, GridPendingChange> = new Map()

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

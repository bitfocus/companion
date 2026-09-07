import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ButtonGridStore, GridClipboard } from './ButtonGridStore.js'
import type { GridPendingChange } from './GridGeometry.js'
import type { GridToolActions, GridToolId } from './GridTools/index.js'

/**
 * Everything a cell on the main editing grid needs in order to interpret a gesture.
 *
 * This is per grid instance rather than app-wide on purpose: it is what lets two grids (eg. two
 * pages side by side) each keep their own selection and their own in-flight tool.
 */
export interface ButtonGridView {
	store: ButtonGridStore
	actions: GridToolActions
	onContextMenu: (location: ControlLocation, x: number, y: number) => void
}

const ButtonGridViewContext = createContext<ButtonGridView | null>(null)

export const ButtonGridViewProvider = ButtonGridViewContext.Provider

export function useButtonGridView(): ButtonGridView {
	const view = useContext(ButtonGridViewContext)
	if (!view) throw new Error('useButtonGridView must be used inside a ButtonGridViewProvider')
	return view
}

export function useButtonGridStore(): ButtonGridStore {
	return useButtonGridView().store
}

/**
 * Read one value out of the grid store.
 *
 * The selector must return something React can compare - a primitive, or a value the store keeps a
 * stable identity for - otherwise every notification looks like a change.
 */
function useGridStoreValue<T>(select: (store: ButtonGridStore) => T): T {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,

		useCallback(() => select(store), [store, select])
	)
}

/** Whether this one cell is selected. A boolean, so unaffected cells skip the re-render entirely. */
export function useGridIsSelected(locationKey: string): boolean {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.isSelected(locationKey), [store, locationKey])
	)
}

/**
 * The button that would end up on this cell if the drag in flight were released, or null.
 *
 * Returns the location rather than a boolean so the cell can draw that button's own image as a
 * ghost - which is what makes it possible to check a large block has lined up.
 */
export function useGridDropGhostSource(locationKey: string): ControlLocation | null {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.dropGhostSource(locationKey), [store, locationKey])
	)
}

const selectDragPreviewValid = (store: ButtonGridStore) => store.dragPreviewValid
export function useGridDragPreviewValid(): boolean {
	return useGridStoreValue(selectDragPreviewValid)
}

/** Whether this one cell has been picked up by the active tool, waiting to be placed */
export function useGridIsTransferSource(locationKey: string): boolean {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.isTransferSource(locationKey), [store, locationKey])
	)
}

/** What the modifier-click being lined up right now would do to this one cell */
export function useGridPendingChange(locationKey: string): GridPendingChange | null {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.pendingChange(locationKey), [store, locationKey])
	)
}

const selectPressMode = (store: ButtonGridStore) => store.pressMode
export function useGridPressMode(): boolean {
	return useGridStoreValue(selectPressMode)
}

const selectDragAnyButton = (store: ButtonGridStore) => store.dragAnyButton
export function useGridDragAnyButton(): boolean {
	return useGridStoreValue(selectDragAnyButton)
}

const selectPendingChangesJoin = (store: ButtonGridStore) => store.pendingChangesJoin
export function useGridPendingChangesJoin(): 'selection' | 'held-buttons' {
	return useGridStoreValue(selectPendingChangesJoin)
}

const selectActiveToolId = (store: ButtonGridStore) => store.activeToolId
export function useGridActiveToolId(): GridToolId {
	return useGridStoreValue(selectActiveToolId)
}

const selectSelectionCount = (store: ButtonGridStore) => store.selectionCount
export function useGridSelectionCount(): number {
	return useGridStoreValue(selectSelectionCount)
}

const selectSelectedLocations = (store: ButtonGridStore) => store.selectedLocations
export function useGridSelectedLocations(): readonly ControlLocation[] {
	return useGridStoreValue(selectSelectedLocations)
}

const selectSelectionPageNumber = (store: ButtonGridStore) => store.selectionPageNumber
export function useGridSelectionPageNumber(): number | null {
	return useGridStoreValue(selectSelectionPageNumber)
}

const selectFocus = (store: ButtonGridStore) => store.focus
export function useGridFocus(): ControlLocation | null {
	return useGridStoreValue(selectFocus)
}

const selectClipboard = (store: ButtonGridStore) => store.clipboard
export function useGridClipboard(): GridClipboard | null {
	return useGridStoreValue(selectClipboard)
}

/** What the grid should be telling the user right now, if anything */
export function useGridHint(): string | null {
	const { store, actions } = useButtonGridView()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.hint(actions), [store, actions])
	)
}

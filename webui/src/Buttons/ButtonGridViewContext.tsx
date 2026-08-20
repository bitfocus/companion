import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ButtonGridStore, GridClipboard } from './ButtonGridStore.js'
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

/** Whether this one cell has been picked up by the active tool, waiting to be placed */
export function useGridIsTransferSource(locationKey: string): boolean {
	const store = useButtonGridStore()
	return useSyncExternalStore(
		store.subscribe,
		useCallback(() => store.isTransferSource(locationKey), [store, locationKey])
	)
}

const selectPressMode = (store: ButtonGridStore) => store.pressMode
export function useGridPressMode(): boolean {
	return useGridStoreValue(selectPressMode)
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

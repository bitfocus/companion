/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { TableVisibilityHelper } from '~/Components/TableVisibility.js'
import type { VisibleConnectionsState } from './ConnectionList.js'

/**
 * The stable per-row collaborators. Deliberately kept free of the filter/count state below: every
 * row consumes this, so anything that changes on a keystroke or a status update would re-render the
 * whole list.
 */
export interface ConnectionListContextType {
	showVariables: (label: string) => void
	deleteModalRef: RefObject<GenericConfirmModalRef | null>
	configureConnection: (connectionId: string | null) => void
}

/** Filter/summary state, consumed only by the list heading and the empty state. */
export interface ConnectionListFilterContextType {
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	searchText: string
	setSearchText: (text: string) => void
	counts: {
		disabled: number
		ok: number
		warning: number
		error: number
	}
}

const ConnectionListContext = createContext<ConnectionListContextType | null>(null)
const ConnectionListFilterContext = createContext<ConnectionListFilterContextType | null>(null)

export function useConnectionListContext(): ConnectionListContextType {
	const ctx = useContext(ConnectionListContext)
	if (!ctx) throw new Error('useConnectionListContext must be used within a ConnectionListProvider')
	return ctx
}

export function useConnectionListFilterContext(): ConnectionListFilterContextType {
	const ctx = useContext(ConnectionListFilterContext)
	if (!ctx) throw new Error('useConnectionListFilterContext must be used within a ConnectionListProvider')
	return ctx
}

export function ConnectionListContextProvider({
	visibleConnections,
	showVariables,
	deleteModalRef,
	configureConnection,
	searchText,
	setSearchText,
	counts,
	children,
}: React.PropsWithChildren<ConnectionListContextType & ConnectionListFilterContextType>): React.JSX.Element {
	const rowValue = useMemo<ConnectionListContextType>(
		() => ({ showVariables, deleteModalRef, configureConnection }),
		[showVariables, deleteModalRef, configureConnection]
	)

	const filterValue = useMemo<ConnectionListFilterContextType>(
		() => ({
			visibleConnections, // TODO - is this too reactive?
			searchText,
			setSearchText,
			counts,
		}),
		[visibleConnections, searchText, setSearchText, counts]
	)

	return (
		<ConnectionListContext.Provider value={rowValue}>
			<ConnectionListFilterContext.Provider value={filterValue}>{children}</ConnectionListFilterContext.Provider>
		</ConnectionListContext.Provider>
	)
}

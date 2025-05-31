import React, { createContext, RefObject, useContext, useMemo } from 'react'
import type { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import type { VisibleConnectionsState } from './ConnectionList.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'

export interface ConnectionListContextType {
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showVariables: (label: string) => void
	deleteModalRef: RefObject<GenericConfirmModalRef>
	configureConnection: (connectionId: string | null) => void
}

const ConnectionListContext = createContext<ConnectionListContextType | null>(null)

export function useConnectionListContext() {
	const ctx = useContext(ConnectionListContext)
	if (!ctx) throw new Error('useConnectionListContext must be used within a ConnectionListProvider')
	return ctx
}

interface ConnectionListContextProviderProps extends ConnectionListContextType {
	// visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
}

export function ConnectionListContextProvider({
	visibleConnections,
	showVariables,
	deleteModalRef,
	configureConnection,
	children,
}: React.PropsWithChildren<ConnectionListContextProviderProps>) {
	const value = useMemo<ConnectionListContextType>(() => {
		return {
			visibleConnections,
			showVariables,
			deleteModalRef,
			configureConnection,
		}
	}, [
		visibleConnections, // TODO - is this too reactive?
		showVariables,
		deleteModalRef,
		configureConnection,
	])

	return <ConnectionListContext.Provider value={value}>{children}</ConnectionListContext.Provider>
}

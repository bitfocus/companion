/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, type RefObject } from 'react'
import type { TableVisibilityHelper } from '~/Components/TableVisibility.js'
import type { VisibleConnectionsState } from './ConnectionList.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface ConnectionListContextType {
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showVariables: (label: string) => void
	deleteModalRef: RefObject<GenericConfirmModalRef>
	configureConnection: (connectionId: string | null) => void
}

const ConnectionListContext = createContext<ConnectionListContextType | null>(null)

export function useConnectionListContext(): ConnectionListContextType {
	const ctx = useContext(ConnectionListContext)
	if (!ctx) throw new Error('useConnectionListContext must be used within a ConnectionListProvider')
	return ctx
}

type ConnectionListContextProviderProps = ConnectionListContextType

export function ConnectionListContextProvider({
	visibleConnections,
	showVariables,
	deleteModalRef,
	configureConnection,
	children,
}: React.PropsWithChildren<ConnectionListContextProviderProps>): React.JSX.Element {
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

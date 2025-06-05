import React, { createContext, RefObject, useContext, useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface TriggersTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	selectTrigger: (triggerId: string | null) => void
}

const TriggersTableContext = createContext<TriggersTableContextType | null>(null)

export function useTriggersTableContext() {
	const ctx = useContext(TriggersTableContext)
	if (!ctx) throw new Error('useTriggersTableContext must be used within a TriggersTableProvider')
	return ctx
}

interface TriggersTableContextProviderProps extends TriggersTableContextType {
	// visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
}

export function TriggersTableContextProvider({
	deleteModalRef,
	selectTrigger,
	children,
}: React.PropsWithChildren<TriggersTableContextProviderProps>) {
	const value = useMemo<TriggersTableContextType>(() => {
		return {
			deleteModalRef,
			selectTrigger,
		}
	}, [deleteModalRef, selectTrigger])

	return <TriggersTableContext.Provider value={value}>{children}</TriggersTableContext.Provider>
}

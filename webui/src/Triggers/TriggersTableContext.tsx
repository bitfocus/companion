/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface TriggersTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	selectTrigger: (triggerId: string | null) => void
}

const TriggersTableContext = createContext<TriggersTableContextType | null>(null)

export function useTriggersTableContext(): TriggersTableContextType {
	const ctx = useContext(TriggersTableContext)
	if (!ctx) throw new Error('useTriggersTableContext must be used within a TriggersTableProvider')
	return ctx
}

type TriggersTableContextProviderProps = TriggersTableContextType

export function TriggersTableContextProvider({
	deleteModalRef,
	selectTrigger,
	children,
}: React.PropsWithChildren<TriggersTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<TriggersTableContextType>(() => {
		return {
			deleteModalRef,
			selectTrigger,
		}
	}, [deleteModalRef, selectTrigger])

	return <TriggersTableContext.Provider value={value}>{children}</TriggersTableContext.Provider>
}

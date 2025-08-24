/* eslint-disable react-refresh/only-export-components */
import React, { createContext, RefObject, useContext, useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface ComputedVariablesTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	selectComputedVariable: (computedvariableId: string | null) => void
}

const ComputedVariablesTableContext = createContext<ComputedVariablesTableContextType | null>(null)

export function useComputedVariablesTableContext(): ComputedVariablesTableContextType {
	const ctx = useContext(ComputedVariablesTableContext)
	if (!ctx) throw new Error('useComputedVariablesTableContext must be used within a ComputedVariablesTableProvider')
	return ctx
}

type ComputedVariablesTableContextProviderProps = ComputedVariablesTableContextType

export function ComputedVariablesTableContextProvider({
	deleteModalRef,
	selectComputedVariable,
	children,
}: React.PropsWithChildren<ComputedVariablesTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<ComputedVariablesTableContextType>(() => {
		return {
			deleteModalRef,
			selectComputedVariable,
		}
	}, [deleteModalRef, selectComputedVariable])

	return <ComputedVariablesTableContext.Provider value={value}>{children}</ComputedVariablesTableContext.Provider>
}

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface ExpressionVariablesTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	selectExpressionVariable: (expressionVariableId: string | null) => void
}

const ExpressionVariablesTableContext = createContext<ExpressionVariablesTableContextType | null>(null)

export function useExpressionVariablesTableContext(): ExpressionVariablesTableContextType {
	const ctx = useContext(ExpressionVariablesTableContext)
	if (!ctx)
		throw new Error('useExpressionVariablesTableContext must be used within an ExpressionVariablesTableProvider')
	return ctx
}

type ExpressionVariablesTableContextProviderProps = ExpressionVariablesTableContextType

export function ExpressionVariablesTableContextProvider({
	deleteModalRef,
	selectExpressionVariable,
	children,
}: React.PropsWithChildren<ExpressionVariablesTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<ExpressionVariablesTableContextType>(() => {
		return {
			deleteModalRef,
			selectExpressionVariable,
		}
	}, [deleteModalRef, selectExpressionVariable])

	return <ExpressionVariablesTableContext.Provider value={value}>{children}</ExpressionVariablesTableContext.Provider>
}

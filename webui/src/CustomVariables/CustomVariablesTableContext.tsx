/* eslint-disable react-refresh/only-export-components */
import React, { createContext, RefObject, useContext, useMemo } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface CustomVariablesTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	selectCustomVariable: (customvariableId: string | null) => void
}

const CustomVariablesTableContext = createContext<CustomVariablesTableContextType | null>(null)

export function useCustomVariablesTableContext(): CustomVariablesTableContextType {
	const ctx = useContext(CustomVariablesTableContext)
	if (!ctx) throw new Error('useCustomVariablesTableContext must be used within a CustomVariablesTableProvider')
	return ctx
}

type CustomVariablesTableContextProviderProps = CustomVariablesTableContextType

export function CustomVariablesTableContextProvider({
	deleteModalRef,
	selectCustomVariable,
	children,
}: React.PropsWithChildren<CustomVariablesTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<CustomVariablesTableContextType>(() => {
		return {
			deleteModalRef,
			selectCustomVariable,
		}
	}, [deleteModalRef, selectCustomVariable])

	return <CustomVariablesTableContext.Provider value={value}>{children}</CustomVariablesTableContext.Provider>
}

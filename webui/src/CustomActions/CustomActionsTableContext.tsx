/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface CustomActionsTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef | null>
	selectCustomAction: (customActionId: string | null) => void
	selectedCustomActionId: string | null
}

const CustomActionsTableContext = createContext<CustomActionsTableContextType | null>(null)

export function useCustomActionsTableContext(): CustomActionsTableContextType {
	const ctx = useContext(CustomActionsTableContext)
	if (!ctx) throw new Error('useCustomActionsTableContext must be used within a CustomActionsTableContextProvider')
	return ctx
}

type CustomActionsTableContextProviderProps = CustomActionsTableContextType

export function CustomActionsTableContextProvider({
	deleteModalRef,
	selectCustomAction,
	selectedCustomActionId,
	children,
}: React.PropsWithChildren<CustomActionsTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<CustomActionsTableContextType>(() => {
		return {
			deleteModalRef,
			selectCustomAction,
			selectedCustomActionId,
		}
	}, [deleteModalRef, selectCustomAction, selectedCustomActionId])

	return <CustomActionsTableContext.Provider value={value}>{children}</CustomActionsTableContext.Provider>
}

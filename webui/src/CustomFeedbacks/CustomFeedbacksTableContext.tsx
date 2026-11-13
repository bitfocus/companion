/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface CustomFeedbacksTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef | null>
	selectCustomFeedback: (customFeedbackId: string | null) => void
	selectedCustomFeedbackId: string | null
}

const CustomFeedbacksTableContext = createContext<CustomFeedbacksTableContextType | null>(null)

export function useCustomFeedbacksTableContext(): CustomFeedbacksTableContextType {
	const ctx = useContext(CustomFeedbacksTableContext)
	if (!ctx) throw new Error('useCustomFeedbacksTableContext must be used within a CustomFeedbacksTableContextProvider')
	return ctx
}

type CustomFeedbacksTableContextProviderProps = CustomFeedbacksTableContextType

export function CustomFeedbacksTableContextProvider({
	deleteModalRef,
	selectCustomFeedback,
	selectedCustomFeedbackId,
	children,
}: React.PropsWithChildren<CustomFeedbacksTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<CustomFeedbacksTableContextType>(() => {
		return {
			deleteModalRef,
			selectCustomFeedback,
			selectedCustomFeedbackId,
		}
	}, [deleteModalRef, selectCustomFeedback, selectedCustomFeedbackId])

	return <CustomFeedbacksTableContext.Provider value={value}>{children}</CustomFeedbacksTableContext.Provider>
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type RefObject } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface CustomPresetsTableContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef | null>
	selectCustomPreset: (customPresetId: string | null) => void
	selectedCustomPresetId: string | null
}

const CustomPresetsTableContext = createContext<CustomPresetsTableContextType | null>(null)

export function useCustomPresetsTableContext(): CustomPresetsTableContextType {
	const ctx = useContext(CustomPresetsTableContext)
	if (!ctx) throw new Error('useCustomPresetsTableContext must be used within a CustomPresetsTableContextProvider')
	return ctx
}

type CustomPresetsTableContextProviderProps = CustomPresetsTableContextType

export function CustomPresetsTableContextProvider({
	deleteModalRef,
	selectCustomPreset,
	selectedCustomPresetId,
	children,
}: React.PropsWithChildren<CustomPresetsTableContextProviderProps>): React.JSX.Element {
	const value = useMemo<CustomPresetsTableContextType>(() => {
		return {
			deleteModalRef,
			selectCustomPreset,
			selectedCustomPresetId,
		}
	}, [deleteModalRef, selectCustomPreset, selectedCustomPresetId])

	return <CustomPresetsTableContext.Provider value={value}>{children}</CustomPresetsTableContext.Provider>
}

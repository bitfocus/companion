/* eslint-disable react-refresh/only-export-components */
import React, { createContext, RefObject, useContext, useMemo } from 'react'
import type { TableVisibilityHelper } from '~/Components/TableVisibility.js'
import type { VisibleInstancesState } from './SurfaceInstanceList.js'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface SurfaceInstanceListContextType {
	visibleInstances: TableVisibilityHelper<VisibleInstancesState>
	deleteModalRef: RefObject<GenericConfirmModalRef>
	configureInstance: (instanceId: string | null) => void
}

const SurfaceInstanceListContext = createContext<SurfaceInstanceListContextType | null>(null)

export function useSurfaceInstanceListContext(): SurfaceInstanceListContextType {
	const ctx = useContext(SurfaceInstanceListContext)
	if (!ctx) throw new Error('useSurfaceInstanceListContext must be used within a SurfaceInstanceListProvider')
	return ctx
}

type SurfaceInstanceListContextProviderProps = SurfaceInstanceListContextType

export function SurfaceInstanceListContextProvider({
	visibleInstances,
	deleteModalRef,
	configureInstance,
	children,
}: React.PropsWithChildren<SurfaceInstanceListContextProviderProps>): React.JSX.Element {
	const value = useMemo<SurfaceInstanceListContextType>(() => {
		return {
			visibleInstances: visibleInstances,
			deleteModalRef,
			configureInstance: configureInstance,
		}
	}, [
		visibleInstances, // TODO - is this too reactive?
		deleteModalRef,
		configureInstance,
	])

	return <SurfaceInstanceListContext.Provider value={value}>{children}</SurfaceInstanceListContext.Provider>
}

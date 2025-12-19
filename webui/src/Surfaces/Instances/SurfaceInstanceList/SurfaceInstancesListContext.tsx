/* eslint-disable react-refresh/only-export-components */
import React, { createContext, type RefObject, useContext, useMemo } from 'react'
import type { TableVisibilityHelper } from '~/Components/TableVisibility.js'
import type { VisibleSurfaceInstancesState } from './SurfaceInstanceList.js'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface SurfaceInstancesListContextType {
	visibleInstances: TableVisibilityHelper<VisibleSurfaceInstancesState>
	deleteModalRef: RefObject<GenericConfirmModalRef>
	configureInstance: (instanceId: string | null) => void
}

const SurfaceInstancesListContext = createContext<SurfaceInstancesListContextType | null>(null)

export function useSurfaceInstancesListContext(): SurfaceInstancesListContextType {
	const ctx = useContext(SurfaceInstancesListContext)
	if (!ctx) throw new Error('useSurfaceInstancesListContext must be used within a SurfaceInstancesListContextProvider')
	return ctx
}

type SurfaceInstancesListContextProviderProps = SurfaceInstancesListContextType

export function SurfaceInstancesListContextProvider({
	visibleInstances,
	deleteModalRef,
	configureInstance,
	children,
}: React.PropsWithChildren<SurfaceInstancesListContextProviderProps>): React.JSX.Element {
	const value = useMemo<SurfaceInstancesListContextType>(() => {
		return {
			visibleInstances,
			deleteModalRef,
			configureInstance,
		}
	}, [
		visibleInstances, // TODO - is this too reactive?
		deleteModalRef,
		configureInstance,
	])

	return <SurfaceInstancesListContext.Provider value={value}>{children}</SurfaceInstancesListContext.Provider>
}

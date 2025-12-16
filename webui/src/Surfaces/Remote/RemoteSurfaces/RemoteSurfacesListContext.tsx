/* eslint-disable react-refresh/only-export-components */
import React, { createContext, type RefObject, useContext, useMemo } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'

export interface RemoteSurfacesListContextType {
	deleteModalRef: RefObject<GenericConfirmModalRef>
	configureRemoteConnection: (connectionId: string | null) => void
}

const RemoteSurfacesListContext = createContext<RemoteSurfacesListContextType | null>(null)

export function useRemoteSurfacesListContext(): RemoteSurfacesListContextType {
	const ctx = useContext(RemoteSurfacesListContext)
	if (!ctx) throw new Error('useRemoteSurfacesListContext must be used within a RemoteSurfacesListContextProvider')
	return ctx
}

type RemoteSurfacesListContextProviderProps = RemoteSurfacesListContextType

export function RemoteSurfacesListContextProvider({
	deleteModalRef,
	configureRemoteConnection,
	children,
}: React.PropsWithChildren<RemoteSurfacesListContextProviderProps>): React.JSX.Element {
	const value = useMemo<RemoteSurfacesListContextType>(() => {
		return {
			deleteModalRef,
			configureRemoteConnection,
		}
	}, [deleteModalRef, configureRemoteConnection])

	return <RemoteSurfacesListContext.Provider value={value}>{children}</RemoteSurfacesListContext.Provider>
}

/* eslint-disable react-refresh/only-export-components */
import type { ClientDiscoveredSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import React, { createContext, memo, useContext, useMemo } from 'react'
import { useSurfaceDiscoverySubscription } from './useSurfaceDiscoverySubscription'

export interface SurfaceDiscoveryContextType {
	discoveredSurfaces: Record<string, ClientDiscoveredSurfaceInfo | undefined>
}

const SurfaceDiscoveryContext = createContext<SurfaceDiscoveryContextType | null>(null)

export function useSurfaceDiscoveryContext(): SurfaceDiscoveryContextType {
	const ctx = useContext(SurfaceDiscoveryContext)
	if (!ctx) throw new Error('useSurfaceDiscoveryContext must be used within a SurfaceDiscoveryContextProvider')
	return ctx
}

export const SurfaceDiscoveryContextProvider = memo(function SurfaceDiscoveryContextProvider({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	const discoveredSurfaces = useSurfaceDiscoverySubscription()
	const value = useMemo<SurfaceDiscoveryContextType>(() => {
		return {
			discoveredSurfaces,
		}
	}, [discoveredSurfaces])

	return <SurfaceDiscoveryContext.Provider value={value}>{children}</SurfaceDiscoveryContext.Provider>
})

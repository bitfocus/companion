import { useState } from 'react'
import type { SurfacesStore } from '~/Stores/SurfacesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useSurfacesSubscription(store: SurfacesStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.surfaces.watchSurfaces.subscriptionOptions(undefined, {
			onStarted: () => {
				setReady(false)
				store.updateSurfaces(null)
			},
			onData: (data) => {
				setReady(true)
				store.updateSurfaces(data)
			},
			onError: (error) => {
				console.error('Failed to subscribe to surfaces:', error)
				store.updateSurfaces(null)
			},
		})
	)

	return ready
}

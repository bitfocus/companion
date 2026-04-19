import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { SurfacesStore } from '~/Stores/SurfacesStore.js'

export function useOutboundSurfacesSubscription(
	store: SurfacesStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.surfaces.outbound.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				setReady(false)
				setLoadError?.(null)
				store.updateOutboundSurfaces(null)
			},
			onData: (data) => {
				setReady(true)
				store.updateOutboundSurfaces(data)
			},
			onError: (error) => {
				setLoadError?.(error.message)
			},
		})
	)

	return ready
}

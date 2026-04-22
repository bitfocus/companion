import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { SurfaceInstancesStore } from '~/Stores/SurfaceInstancesStore'

export function useSurfaceInstancesSubscription(store: SurfaceInstancesStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.instances.surfaces.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateInstances(null)
				setReady(false)
			},
			onData: (changes) => {
				store.updateInstances(changes)
				setReady(true)
			},
			onError: (error) => {
				store.updateInstances(null)
				console.error('Failed to load surface integrations list', error)
			},
		})
	)

	return ready
}

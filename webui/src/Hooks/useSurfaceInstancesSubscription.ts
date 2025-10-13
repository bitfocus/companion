import { useState } from 'react'
import type { SurfaceInstancesStore } from '~/Stores/SurfaceInstancesStore'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

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
				console.error('Failed to load surface instances list', error)
			},
		})
	)

	return ready
}

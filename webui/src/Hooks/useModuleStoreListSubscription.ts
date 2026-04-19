import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'

export function useModuleStoreListSubscription(store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.instances.modulesStore.watchList.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStoreInfo(null)
				setReady(false)
			},
			onData: (data) => {
				store.updateStoreInfo(data)
				setReady(true)
			},
			onError: (error) => {
				store.updateStoreInfo(null)
				console.error('Failed to load modules store', error)
			},
		})
	)

	return ready
}

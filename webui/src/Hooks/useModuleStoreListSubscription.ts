import { useState } from 'react'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useModuleStoreListSubscription(store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.connections.modulesStore.watchList.subscriptionOptions(undefined, {
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

import { useState } from 'react'
import { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useModuleInfoSubscription(store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.instances.modules.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				setReady(true)
				store.updateStore(data)
			},
			onError: (err) => {
				store.updateStore(null)
				console.error('Failed to subscribe to module info updates', err)
			},
		})
	)

	return ready
}

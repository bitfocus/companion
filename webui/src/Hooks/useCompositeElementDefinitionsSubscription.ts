import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { CompositeElementDefinitionsStore } from '~/Stores/CompositeElementDefinitionsStore.js'

export function useCompositeElementDefinitionsSubscription(store: CompositeElementDefinitionsStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.instances.definitions.compositeElements.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				store.updateStore(data)
				setReady(true)
			},
			onError: (e) => {
				store.updateStore(null)
				console.error('Failed to load composite element definitions list', e)
			},
		})
	)

	return ready
}

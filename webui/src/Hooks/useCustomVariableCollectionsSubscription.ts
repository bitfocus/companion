import { useState } from 'react'
import type { VariablesStore } from '~/Stores/VariablesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'

export function useCustomVariableCollectionsSubscription(store: VariablesStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.customVariables.collections.watchQuery.subscriptionOptions(undefined, {
			onStarted: () => {
				setReady(false)
				store.resetCustomVariableCollections([])
			},
			onData: (data) => {
				setReady(true)
				// TODO - should this debounce?

				store.resetCustomVariableCollections(data)
			},
		})
	)

	return ready
}

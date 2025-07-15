import { useState } from 'react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC.js'
import { CustomVariablesListStore } from '~/Stores/CustomVariablesListStore'

export function useCustomVariableCollectionsSubscription(store: CustomVariablesListStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.controls.customVariables.collections.watchQuery.subscriptionOptions(undefined, {
			onStarted: () => {
				setReady(false)
				store.resetCollections([])
			},
			onData: (data) => {
				setReady(true)
				// TODO - should this debounce?

				store.resetCollections(data)
			},
		})
	)

	return ready
}

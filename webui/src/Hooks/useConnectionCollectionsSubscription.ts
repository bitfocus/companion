import { useState } from 'react'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC.js'

export function useConnectionCollectionsSubscription(store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.connections.collections.watchQuery.subscriptionOptions(undefined, {
			onStarted: () => {
				// TODO - clear on termination?
				setReady(true)
				store.resetCollections([])
			},
			onData: (data) => {
				// TODO - should this debounce?

				store.resetCollections(data)
			},
		})
	)

	return ready
}

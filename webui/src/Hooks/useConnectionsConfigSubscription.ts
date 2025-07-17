import { useState } from 'react'
import type { ConnectionsStore } from '~/Stores/ConnectionsStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useConnectionsConfigSubscription(store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.connections.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateConnections(null)
				setReady(false)
			},
			onData: (changes) => {
				store.updateConnections(changes)
				setReady(true)
			},
			onError: (error) => {
				store.updateConnections(null)
				console.error('Failed to load connections list', error)
			},
		})
	)

	return ready
}

import { useState } from 'react'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useTriggersListSubscription(store: TriggersListStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.controls.triggers.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				setReady(false)
				store.updateTriggers(null)
			},
			onData: (data) => {
				setReady(true)

				store.updateTriggers(data)
			},
		})
	)

	return ready
}

import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

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

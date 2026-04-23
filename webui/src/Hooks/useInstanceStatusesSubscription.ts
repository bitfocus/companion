import { useSubscription } from '@trpc/tanstack-react-query'
import { runInAction } from 'mobx'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { InstanceStatusesStore } from '~/Stores/InstanceStatusesStore.js'

export function useInstanceStatusesSubscription(store: InstanceStatusesStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.instances.statuses.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => {
					store.updateStatuses(null)
				})
				setReady(false)
			},
			onData: (data) => {
				runInAction(() => {
					store.updateStatuses(data)
				})
				setReady(true)
			},
			onError: (error) => {
				runInAction(() => {
					store.updateStatuses(null)
				})
				console.error('Error in instance statuses subscription', error)
			},
		})
	)

	return ready
}

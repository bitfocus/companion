import { useState } from 'react'
import type { InstanceStatusesStore } from '~/Stores/InstanceStatusesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import { runInAction } from 'mobx'

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

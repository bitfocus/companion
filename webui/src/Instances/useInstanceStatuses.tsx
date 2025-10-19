import { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { ObservableMap, observable, runInAction } from 'mobx'
import { useMemo } from 'react'
import { trpc } from '~/Resources/TRPC'
import { assertNever } from '~/Resources/util.js'

export function useInstanceStatuses(): ObservableMap<string, InstanceStatusEntry> {
	const instanceStatuses = useMemo(() => observable.map<string, InstanceStatusEntry>(), [])

	useSubscription(
		trpc.instances.statuses.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => {
					instanceStatuses.clear()
				})
			},
			onData: (data) => {
				runInAction(() => {
					switch (data.type) {
						case 'init':
							instanceStatuses.replace(data.statuses)
							break
						case 'remove':
							instanceStatuses.delete(data.instanceId)
							break
						case 'update':
							instanceStatuses.set(data.instanceId, data.status)
							break
						default:
							assertNever(data)
							break
					}
				})
			},
			onError: (error) => {
				console.error('Error in instance statuses subscription', error)
			},
		})
	)

	return instanceStatuses
}

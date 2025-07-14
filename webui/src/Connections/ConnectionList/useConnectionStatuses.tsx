import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { ObservableMap, observable, runInAction } from 'mobx'
import { useMemo } from 'react'
import { trpc } from '~/TRPC'
import { assertNever } from '~/util.js'

export function useConnectionStatuses(): ObservableMap<string, ConnectionStatusEntry> {
	const connectionStatuses = useMemo(() => observable.map<string, ConnectionStatusEntry>(), [])

	useSubscription(
		trpc.connections.statuses.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => {
					connectionStatuses.clear()
				})
			},
			onData: (data) => {
				runInAction(() => {
					switch (data.type) {
						case 'init':
							connectionStatuses.replace(data.statuses)
							break
						case 'remove':
							connectionStatuses.delete(data.connectionId)
							break
						case 'update':
							connectionStatuses.set(data.connectionId, data.status)
							break
						default:
							assertNever(data)
							break
					}
				})
			},
			onError: (error) => {
				console.error('Error in connection statuses subscription', error)
			},
		})
	)

	return connectionStatuses
}

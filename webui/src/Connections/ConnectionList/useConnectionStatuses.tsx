import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { ObservableMap, observable, runInAction } from 'mobx'
import { useContext, useEffect, useMemo } from 'react'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { assertNever } from '../../util.js'

export function useConnectionStatuses(): ObservableMap<string, ConnectionStatusEntry> {
	const { socket } = useContext(RootAppStoreContext)

	const connectionStatuses = useMemo(() => observable.map<string, ConnectionStatusEntry>(), [])

	useEffect(() => {
		let mounted = true
		socket
			.emitPromise('connections:get-statuses', [])
			.then((statuses) => {
				if (!mounted) return

				runInAction(() => {
					connectionStatuses.replace(statuses)
				})
			})
			.catch((e) => {
				console.error(`Failed to load connection statuses`, e)
			})

		const unsubStatuses = socket.on('connections:update-statuses', (changes) => {
			if (!mounted) return

			runInAction(() => {
				for (const change of changes) {
					switch (change.type) {
						case 'remove':
							connectionStatuses.delete(change.connectionId)
							break
						case 'update':
							connectionStatuses.set(change.connectionId, change.status)
							break
						default:
							assertNever(change)
							break
					}
				}
			})
		})

		return () => {
			mounted = false
			unsubStatuses()

			runInAction(() => {
				connectionStatuses.clear()
			})
		}
	}, [socket, connectionStatuses])

	return connectionStatuses
}

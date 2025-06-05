import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'

export function useConnectionGroupsSubscription(socket: CompanionSocketWrapped, store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetGroups(null)
		setReady(false)

		socket
			.emitPromise('connection-collections:subscribe', [])
			.then((groups) => {
				store.resetGroups(groups)
				setReady(true)
			})
			.catch((e) => {
				store.resetGroups(null)
				console.error('Failed to load connection groups list', e)
			})

		const unsubUpdates = socket.on('connection-collections:update', (update) => {
			store.resetGroups(update)
		})

		return () => {
			store.resetGroups(null)
			unsubUpdates()

			socket.emitPromise('connection-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from connection groups list:', e)
			})
		}
	}, [socket, store])

	return ready
}

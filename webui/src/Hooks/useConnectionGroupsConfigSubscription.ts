import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'

export function useConnectionGroupsConfigSubscription(
	socket: CompanionSocketWrapped,
	store: ConnectionsStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetGroups(null)
		setReady(false)

		socket
			.emitPromise('connection-groups:subscribe', [])
			.then((groups) => {
				store.resetGroups(groups)
				setReady(true)
			})
			.catch((e) => {
				store.resetGroups(null)
				console.error('Failed to load connection groups list', e)
			})

		const unsubUpdates = socket.on('connection-groups:patch', (change) => {
			store.applyGroupsChange(change)
		})

		return () => {
			store.resetGroups(null)
			unsubUpdates()

			socket.emitPromise('connection-groups:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from connection groups list:', e)
			})
		}
	}, [socket, store])

	return ready
}

import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'

export function useConnectionsConfigSubscription(socket: CompanionSocketWrapped, store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetConnections(null)
		setReady(false)

		socket
			.emitPromise('connections:subscribe', [])
			.then((connections) => {
				store.resetConnections(connections)
				setReady(true)
			})
			.catch((e) => {
				store.resetConnections(null)
				console.error('Failed to load connections list', e)
			})

		const unsubUpdates = socket.on('connections:patch', (change) => {
			store.applyConnectionsChange(change)
		})

		return () => {
			store.resetConnections(null)
			unsubUpdates()

			socket.emitPromise('connections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from connections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

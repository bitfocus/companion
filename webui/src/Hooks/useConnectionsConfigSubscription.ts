import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'

export function useConnectionsConfigSubscription(socket: CompanionSocketType, store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'connections:subscribe', [])
			.then((connections) => {
				store.reset(connections)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load connections list', e)
			})

		const patchConnections = (change: ClientConnectionsUpdate[]) => {
			store.applyChange(change)
		}
		socket.on('connections:patch', patchConnections)

		return () => {
			store.reset(null)
			socket.off('connections:patch', patchConnections)

			socketEmitPromise(socket, 'connections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from connections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { ConnectionsStore } from '../Stores/ConnectionsStore.js'

export function useConnectionCollectionsSubscription(socket: CompanionSocketWrapped, store: ConnectionsStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCollections(null)
		setReady(false)

		socket
			.emitPromise('connection-collections:subscribe', [])
			.then((collections) => {
				store.resetCollections(collections)
				setReady(true)
			})
			.catch((e) => {
				store.resetCollections(null)
				console.error('Failed to load connection collections list', e)
			})

		const unsubUpdates = socket.on('connection-collections:update', (update) => {
			store.resetCollections(update)
		})

		return () => {
			store.resetCollections(null)
			unsubUpdates()

			socket.emitPromise('connection-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from connection collections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import { ActionDefinitionsStore } from '../Stores/ActionDefinitionsStore.js'

export function useActionDefinitionsSubscription(
	socket: CompanionSocketWrapped,
	store: ActionDefinitionsStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socket
			.emitPromise('action-definitions:subscribe', [])
			.then((data) => {
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load action definitions list', e)
			})

		const unsubUpdates = socket.on('action-definitions:update', (change) => {
			store.applyChanges(change)
		})

		return () => {
			store.reset(null)
			unsubUpdates()

			socket.emitPromise('action-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to action definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

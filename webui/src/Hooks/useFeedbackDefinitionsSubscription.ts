import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import { EntityDefinitionsForTypeStore } from '../Stores/EntityDefinitionsStore.js'

export function useFeedbackDefinitionsSubscription(
	socket: CompanionSocketWrapped,
	store: EntityDefinitionsForTypeStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socket
			.emitPromise('feedback-definitions:subscribe', [])
			.then((data) => {
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load feedback definitions list', e)
			})

		const unsubUpdates = socket.on('feedback-definitions:update', (change) => {
			store.applyChanges(change)
		})

		return () => {
			store.reset(null)
			unsubUpdates()

			socket.emitPromise('feedback-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to feedback definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

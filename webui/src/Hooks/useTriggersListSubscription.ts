import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

export function useTriggersListSubscription(socket: CompanionSocketWrapped, store: TriggersListStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetTriggers(null)
		setReady(false)

		socket
			.emitPromise('triggers:subscribe', [])
			.then((triggers) => {
				store.resetTriggers(triggers)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load triggers list:', e)
				store.resetTriggers(null)
			})

		// const updateFeedbackDefinitions = (change: FeedbackDefinitionUpdate) => {
		// 	store.applyChanges(change)
		// }

		const unsubUpdates = socket.on('triggers:update', (change) => {
			store.applyTriggersChange(change)
		})

		return () => {
			store.resetTriggers(null)

			unsubUpdates()

			socket.emitPromise('triggers:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to action definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

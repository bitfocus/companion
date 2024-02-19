import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { TriggersListStore } from '../Stores/TriggersListStore.js'
import type { TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'

export function useTriggersListSubscription(socket: CompanionSocketType, store: TriggersListStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'triggers:subscribe', [])
			.then((triggers) => {
				store.reset(triggers)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load triggers list:', e)
				store.reset(null)
			})

		// const updateFeedbackDefinitions = (change: FeedbackDefinitionUpdate) => {
		// 	store.applyChanges(change)
		// }

		const updateTriggers = (change: TriggersUpdate) => {
			store.applyChange(change)
		}

		socket.on('triggers:update', updateTriggers)

		return () => {
			store.reset(null)

			socket.off('triggers:update', updateTriggers)

			socketEmitPromise(socket, 'triggers:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to action definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

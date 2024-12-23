import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import { EntityDefinitionUpdate } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityDefinitionsForTypeStore } from '../Stores/EntityDefinitionsStore.js'

export function useFeedbackDefinitionsSubscription(
	socket: CompanionSocketType,
	store: EntityDefinitionsForTypeStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'feedback-definitions:subscribe', [])
			.then((data) => {
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load feedback definitions list', e)
			})

		const updateFeedbackDefinitions = (change: EntityDefinitionUpdate) => {
			store.applyChanges(change)
		}

		socket.on('feedback-definitions:update', updateFeedbackDefinitions)

		return () => {
			store.reset(null)
			socket.off('feedback-definitions:update', updateFeedbackDefinitions)

			socketEmitPromise(socket, 'feedback-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to feedback definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

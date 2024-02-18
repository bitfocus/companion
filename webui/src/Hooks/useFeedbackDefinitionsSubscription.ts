import { useEffect, useState } from 'react'
import { socketEmitPromise } from '../util.js'
import { Socket } from 'socket.io-client'
import { FeedbackDefinitionsStore } from '../Stores/FeedbackDefinitionsStore.js'
import { FeedbackDefinitionUpdate } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export function useFeedbackDefinitionsSubscription(socket: Socket, store: FeedbackDefinitionsStore): boolean {
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

		const updateFeedbackDefinitions = (change: FeedbackDefinitionUpdate) => {
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

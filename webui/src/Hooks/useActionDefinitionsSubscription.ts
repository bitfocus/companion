import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import { EntityDefinitionUpdate } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityDefinitionsForTypeStore } from '../Stores/EntityDefinitionsStore.js'

export function useActionDefinitionsSubscription(
	socket: CompanionSocketType,
	store: EntityDefinitionsForTypeStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'action-definitions:subscribe', [])
			.then((data) => {
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load action definitions list', e)
			})

		const updateActionDefinitions = (change: EntityDefinitionUpdate) => {
			store.applyChanges(change)
		}

		socket.on('action-definitions:update', updateActionDefinitions)

		return () => {
			store.reset(null)
			socket.off('action-definitions:update', updateActionDefinitions)

			socketEmitPromise(socket, 'action-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to action definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}

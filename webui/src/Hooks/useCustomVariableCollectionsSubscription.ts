import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { CustomVariablesListStore } from '~/Stores/CustomVariablesListStore.js'

export function useCustomVariableCollectionsSubscription(
	socket: CompanionSocketWrapped,
	store: CustomVariablesListStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCollection(null)
		setReady(false)

		socket
			.emitPromise('custom-variable-collections:subscribe', [])
			.then((collections) => {
				store.resetCollection(collections)
				setReady(true)
			})
			.catch((e) => {
				store.resetCollection(null)
				console.error('Failed to load connection collections list', e)
			})

		const unsubUpdates = socket.on('custom-variable-collections:update', (update) => {
			store.resetCollection(update)
		})

		return () => {
			store.resetCollection(null)
			unsubUpdates()

			socket.emitPromise('custom-variable-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from custom-variable collections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

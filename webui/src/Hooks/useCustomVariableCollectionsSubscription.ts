import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { VariablesStore } from '~/Stores/VariablesStore.js'

export function useCustomVariableCollectionsSubscription(
	socket: CompanionSocketWrapped,
	store: VariablesStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCustomVariableCollections(null)
		setReady(false)

		socket
			.emitPromise('custom-variable-collections:subscribe', [])
			.then((collections) => {
				store.resetCustomVariableCollections(collections)
				setReady(true)
			})
			.catch((e) => {
				store.resetCustomVariableCollections(null)
				console.error('Failed to load connection collections list', e)
			})

		const unsubUpdates = socket.on('custom-variable-collections:update', (update) => {
			store.resetCustomVariableCollections(update)
		})

		return () => {
			store.resetCustomVariableCollections(null)
			unsubUpdates()

			socket.emitPromise('custom-variable-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from custom-variable collections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

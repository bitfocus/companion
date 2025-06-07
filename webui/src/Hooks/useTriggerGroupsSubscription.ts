import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

export function useTriggerGroupsSubscription(socket: CompanionSocketWrapped, store: TriggersListStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCollection(null)
		setReady(false)

		socket
			.emitPromise('trigger-collections:subscribe', [])
			.then((groups) => {
				store.resetCollection(groups)
				setReady(true)
			})
			.catch((e) => {
				store.resetCollection(null)
				console.error('Failed to load trigger groups list', e)
			})

		const unsubUpdates = socket.on('trigger-collections:update', (update) => {
			store.resetCollection(update)
		})

		return () => {
			store.resetCollection(null)
			unsubUpdates()

			socket.emitPromise('trigger-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from trigger groups list:', e)
			})
		}
	}, [socket, store])

	return ready
}

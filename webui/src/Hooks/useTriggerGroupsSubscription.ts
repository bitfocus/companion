import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { TriggersListStore } from '~/Stores/TriggersListStore.js'

export function useTriggerGroupsSubscription(socket: CompanionSocketWrapped, store: TriggersListStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetGroups(null)
		setReady(false)

		socket
			.emitPromise('trigger-groups:subscribe', [])
			.then((groups) => {
				store.resetGroups(groups)
				setReady(true)
			})
			.catch((e) => {
				store.resetGroups(null)
				console.error('Failed to load trigger groups list', e)
			})

		const unsubUpdates = socket.on('trigger-groups:update', (update) => {
			store.resetGroups(update)
		})

		return () => {
			store.resetGroups(null)
			unsubUpdates()

			socket.emitPromise('trigger-groups:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from trigger groups list:', e)
			})
		}
	}, [socket, store])

	return ready
}

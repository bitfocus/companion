import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import { ModuleInfoStore } from '../Stores/ModuleInfoStore.js'

export function useModuleInfoSubscription(socket: CompanionSocketWrapped, store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socket
			.emitPromise('modules:subscribe', [])
			.then((modules) => {
				store.reset(modules)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load modules list', e)
			})

		const unsubUpdates = socket.on('modules:patch', (change) => {
			store.applyChange(change)
		})

		return () => {
			store.reset(null)
			unsubUpdates()

			socket.emitPromise('modules:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from modules list:', e)
			})
		}
	}, [socket, store])

	return ready
}

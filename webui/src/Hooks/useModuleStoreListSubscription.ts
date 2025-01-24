import { useEffect, useState } from 'react'
import type { CompanionSocketWrapped } from '../util.js'
import type { ModuleInfoStore } from '../Stores/ModuleInfoStore.js'

export function useModuleStoreListSubscription(socket: CompanionSocketWrapped, store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetModules(null)
		setReady(false)

		socket
			.emitPromise('modules-store:list:subscribe', [])
			.then((modules) => {
				store.updateStoreInfo(modules)
				setReady(true)
			})
			.catch((e) => {
				store.resetModules(null)
				console.error('Failed to load modules store', e)
			})

		const unbsubData = socket.on('modules-store:list:data', (change) => {
			store.updateStoreInfo(change)
		})

		return () => {
			store.updateStoreInfo({
				lastUpdated: 0,
				lastUpdateAttempt: 0,
				updateWarning: null,
				modules: {},
			})
			unbsubData()

			socket.emitPromise('modules-store:list:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from modules store:', e)
			})
		}
	}, [socket, store])

	return ready
}

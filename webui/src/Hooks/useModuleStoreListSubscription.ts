import { useEffect, useState } from 'react'
import { socketEmitPromise, type CompanionSocketType } from '../util.js'
import type { ModuleInfoStore } from '../Stores/ModuleInfoStore.js'
import type { ModuleStoreListCacheStore } from '@companion-app/shared/Model/ModulesStore.js'

export function useModuleStoreListSubscription(socket: CompanionSocketType, store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetModules(null)
		setReady(false)

		socketEmitPromise(socket, 'modules-store:list:subscribe', [])
			.then((modules) => {
				store.updateStoreInfo(modules)
				setReady(true)
			})
			.catch((e) => {
				store.resetModules(null)
				console.error('Failed to load modules store', e)
			})

		const updateStoreInfo = (change: ModuleStoreListCacheStore) => {
			store.updateStoreInfo(change)
		}
		socket.on('modules-store:list:data', updateStoreInfo)

		return () => {
			store.updateStoreInfo({
				lastUpdated: 0,
				lastUpdateAttempt: 0,
				updateWarning: null,
				modules: {},
			})
			socket.off('modules-store:list:data', updateStoreInfo)

			socketEmitPromise(socket, 'modules-store:list:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from modules store:', e)
			})
		}
	}, [socket, store])

	return ready
}

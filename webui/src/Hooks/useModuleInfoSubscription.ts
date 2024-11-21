import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import { ModuleInfoStore } from '../Stores/ModuleInfoStore.js'
import { ModuleInfoUpdate } from '@companion-app/shared/Model/ModuleInfo.js'

export function useModuleInfoSubscription(socket: CompanionSocketType, store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetModules(null)
		setReady(false)

		socketEmitPromise(socket, 'modules:subscribe', [])
			.then((modules) => {
				store.resetModules(modules)
				setReady(true)
			})
			.catch((e) => {
				store.resetModules(null)
				console.error('Failed to load modules list', e)
			})

		const patchModules = (change: ModuleInfoUpdate) => {
			store.applyModuleChange(change)
		}
		socket.on('modules:patch', patchModules)

		return () => {
			store.resetModules(null)
			socket.off('modules:patch', patchModules)

			socketEmitPromise(socket, 'modules:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from modules list:', e)
			})
		}
	}, [socket, store])

	return ready
}

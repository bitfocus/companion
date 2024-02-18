import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import { ModuleInfoStore } from '../Stores/ModuleInfoStore.js'
import { ModuleInfoUpdate } from '@companion-app/shared/Model/ModuleInfo.js'

export function useModuleInfoSubscription(socket: CompanionSocketType, store: ModuleInfoStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'modules:subscribe', [])
			.then((modules) => {
				store.reset(modules)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error('Failed to load modules list', e)
			})

		// const updateFeedbackDefinitions = (change: FeedbackDefinitionUpdate) => {
		// 	store.applyChanges(change)
		// }

		const patchModules = (change: ModuleInfoUpdate) => {
			store.applyChange(change)
		}
		socket.on('modules:patch', patchModules)

		return () => {
			store.reset(null)
			socket.off('modules:patch', patchModules)

			socketEmitPromise(socket, 'modules:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from modules list:', e)
			})
		}
	}, [socket, store])

	return ready
}

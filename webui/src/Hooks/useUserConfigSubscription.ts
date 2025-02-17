import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { UserConfigStore } from '../Stores/UserConfigStore.js'

export function useUserConfigSubscription(
	socket: CompanionSocketWrapped,
	store: UserConfigStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.reset(null)
		setReady(false)

		socket
			.emitPromise('userconfig:get-all', [])
			.then((config) => {
				setLoadError?.(null)
				store.reset(config)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load user config', e)
				setLoadError?.(`Failed to load user config`)
				store.reset(null)
			})

		const unsubUpdate = socket.on('set_userconfig_key', (key, value) => {
			store.updateStoreValue(key, value)
		})

		return () => {
			unsubUpdate()
		}
	}, [retryToken, setLoadError, socket, store])

	return ready
}

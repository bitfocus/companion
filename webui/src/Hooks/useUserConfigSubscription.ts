import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { UserConfigStore } from '../Stores/UserConfigStore.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

export function useUserConfigSubscription(
	socket: CompanionSocketType,
	store: UserConfigStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'userconfig:get-all', [])
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

		const updateUserConfigValue = (key: keyof UserConfigModel, value: any) => {
			store.setValue(key, value)
		}

		socket.on('set_userconfig_key', updateUserConfigValue)

		return () => {
			socket.off('set_userconfig_key', updateUserConfigValue)
		}
	}, [retryToken, setLoadError, socket, store])

	return ready
}

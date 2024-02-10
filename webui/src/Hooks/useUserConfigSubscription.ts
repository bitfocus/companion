import { useEffect, useState } from 'react'
import { socketEmitPromise } from '../util.js'
import { Socket } from 'socket.io-client'
import { UserConfigModel } from '@companion/shared/Model/UserConfigModel.js'

export function useUserConfigSubscription(
	socket: Socket,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
) {
	const [userConfig, setUserConfig] = useState<UserConfigModel | null>(null)

	useEffect(() => {
		setLoadError?.(null)
		setUserConfig(null)

		socketEmitPromise(socket, 'userconfig:get-all', [])
			.then((config) => {
				setLoadError?.(null)
				setUserConfig(config)
			})
			.catch((e) => {
				console.error('Failed to load user config', e)
				setLoadError?.(`Failed to load user config`)
			})

		const updateUserConfigValue = (key: keyof UserConfigModel, value: any) => {
			setUserConfig((oldState) =>
				oldState
					? {
							...oldState,
							[key]: value,
						}
					: null
			)
		}

		socket.on('set_userconfig_key', updateUserConfigValue)

		return () => {
			socket.off('set_userconfig_key', updateUserConfigValue)
		}
	}, [retryToken, socket])

	return userConfig
}

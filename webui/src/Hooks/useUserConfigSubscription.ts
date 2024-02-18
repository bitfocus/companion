import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

export function useUserConfigSubscription(
	socket: CompanionSocketType,
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

		const updateUserConfigValue = (key: string, value: any) => {
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

			// socketEmitPromise(socket, 'pages:unsubscribe', []).catch((e) => {
			// 	console.error('Failed to cleanup web-buttons:', e)
			// })
		}
	}, [retryToken, socket])

	return userConfig
}

import { useEffect, useState } from 'react'
import { socketEmitPromise } from '../util'

export function useUserConfigSubscription(socket, setLoadError, retryToken) {
	const [userConfig, setUserConfig] = useState(null)

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

		const updateUserConfigValue = (key, value) => {
			setUserConfig((oldState) => ({
				...oldState,
				[key]: value,
			}))
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

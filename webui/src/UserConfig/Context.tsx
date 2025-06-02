import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { UserConfigProps } from './Components/Common.js'

export function useUserConfigProps(): UserConfigProps | null {
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const setValue = useCallback(
		(key: keyof UserConfigModel, value: any) => {
			console.log('set ', key, value)
			socket.emit('set_userconfig_key', key, value)
		},
		[socket]
	)

	const resetValue = useCallback(
		(key: keyof UserConfigModel) => {
			console.log('reset ', key)
			socket.emit('reset_userconfig_key', key)
		},
		[socket]
	)

	if (!userConfig.properties) return null

	const userConfigProps: UserConfigProps = {
		config: userConfig.properties,
		setValue,
		resetValue,
	}

	return userConfigProps
}

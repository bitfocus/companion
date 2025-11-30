import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { UserConfigProps } from './Components/Common.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

export function useUserConfigProps(): UserConfigProps | null {
	const { userConfig } = useContext(RootAppStoreContext)

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())
	const resetConfigKeyMutation = useMutationExt(trpc.userConfig.resetConfigKey.mutationOptions())

	const setValue = useCallback(
		(key: keyof UserConfigModel, value: any) => {
			console.log('set ', key, value)
			setConfigKeyMutation.mutate({ key, value })
		},
		[setConfigKeyMutation]
	)

	const resetValue = useCallback(
		(key: keyof UserConfigModel) => {
			console.log('reset ', key)
			resetConfigKeyMutation.mutate({ key })
		},
		[resetConfigKeyMutation]
	)

	if (!userConfig.properties) return null

	const userConfigProps: UserConfigProps = {
		config: userConfig.properties,
		setValue,
		resetValue,
	}

	return userConfigProps
}

import { useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useMemo } from 'react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { UserConfigProps } from './Components/Common.js'

export function useUserConfigProps(): UserConfigProps | null {
	const { userConfig } = useContext(RootAppStoreContext)

	const setConfigKeyMutation = useMutationExt(trpc.userConfig.setConfigKey.mutationOptions())
	const resetConfigKeyMutation = useMutationExt(trpc.userConfig.resetConfigKey.mutationOptions())

	// Keys locked by a launch-time override never change at runtime, so a one-time query is enough
	const lockedKeysQuery = useQuery(trpc.userConfig.getLockedKeys.queryOptions())
	const readonlyKeys = useMemo(() => new Set<keyof UserConfigModel>(lockedKeysQuery.data ?? []), [lockedKeysQuery.data])

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
		readonlyKeys,
	}

	return userConfigProps
}

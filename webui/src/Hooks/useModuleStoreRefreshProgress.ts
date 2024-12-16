import { useEffect } from 'react'
import { CompanionSocketType } from '../util.js'
import { ObservableMap, runInAction } from 'mobx'

export function useModuleStoreRefreshProgressSubscription(
	socket: CompanionSocketType,
	moduleStoreRefreshProgress: ObservableMap<string | null, number>
): boolean {
	useEffect(() => {
		// Clear any previous progress
		runInAction(() => moduleStoreRefreshProgress.clear())

		const updateList = (progress: number) => {
			runInAction(() => {
				moduleStoreRefreshProgress.set(null, progress)
			})
		}
		const updateModule = (moduleId: string, progress: number) => {
			runInAction(() => {
				moduleStoreRefreshProgress.set(moduleId, progress)
			})
		}

		socket.on('modules-store:list:progress', updateList)
		socket.on('modules-store:info:progress', updateModule)

		return () => {
			runInAction(() => moduleStoreRefreshProgress.clear())

			socket.off('modules-store:list:progress', updateList)
			socket.off('modules-store:info:progress', updateModule)
		}
	}, [socket, moduleStoreRefreshProgress])

	return true // always ready
}

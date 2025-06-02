import { useEffect } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import { ObservableMap, runInAction } from 'mobx'

export function useModuleStoreRefreshProgressSubscription(
	socket: CompanionSocketWrapped,
	moduleStoreRefreshProgress: ObservableMap<string | null, number>
): boolean {
	useEffect(() => {
		// Clear any previous progress
		runInAction(() => moduleStoreRefreshProgress.clear())

		const unsubProgress = socket.on('modules-store:list:progress', (progress) => {
			runInAction(() => {
				moduleStoreRefreshProgress.set(null, progress)
			})
		})
		const unsubProgress2 = socket.on('modules-store:info:progress', (moduleId, progress) => {
			runInAction(() => {
				moduleStoreRefreshProgress.set(moduleId, progress)
			})
		})

		return () => {
			runInAction(() => moduleStoreRefreshProgress.clear())

			unsubProgress()
			unsubProgress2()
		}
	}, [socket, moduleStoreRefreshProgress])

	return true // always ready
}

import { ObservableMap, runInAction } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useModuleStoreRefreshProgressSubscription(
	moduleStoreRefreshProgress: ObservableMap<string | null, number>
): boolean {
	useSubscription(
		trpc.instances.modulesStore.watchRefreshProgress.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => moduleStoreRefreshProgress.clear())
			},
			onData: (info) => {
				runInAction(() => {
					const id = info.moduleInfo ? (`${info.moduleInfo.moduleType}:${info.moduleInfo.moduleId}` as const) : null
					moduleStoreRefreshProgress.set(id, info.percent)
				})
			},
		})
	)

	return true // always ready
}

import { ObservableMap, runInAction } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC'

export function useModuleStoreRefreshProgressSubscription(
	moduleStoreRefreshProgress: ObservableMap<string | null, number>
): boolean {
	useSubscription(
		trpc.connections.modulesStore.watchRefreshProgress.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => moduleStoreRefreshProgress.clear())
			},
			onData: (info) => {
				runInAction(() => {
					moduleStoreRefreshProgress.set(info.moduleId, info.percent)
				})
			},
		})
	)

	return true // always ready
}

import { runInAction } from 'mobx'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

export function useModuleStoreRefreshProgressSubscription(store: ModuleInfoStore): boolean {
	useSubscription(
		trpc.connections.modulesStore.watchRefreshProgress.subscriptionOptions(
			{ moduleType: store.moduleType },
			{
				onStarted: () => {
					runInAction(() => store.storeRefreshProgress.clear())
				},
				onData: (info) => {
					runInAction(() => {
						store.storeRefreshProgress.set(info.moduleId, info.percent)
					})
				},
			}
		)
	)

	return true // always ready
}

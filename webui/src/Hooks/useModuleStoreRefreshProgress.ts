import { useSubscription } from '@trpc/tanstack-react-query'
import { runInAction, type ObservableMap } from 'mobx'
import { trpc } from '~/Resources/TRPC'
import type { ModuleStoreRefreshState } from '~/Stores/ModuleInfoStore.js'

export function useModuleStoreRefreshProgressSubscription(
	moduleStoreRefreshProgress: ObservableMap<string | null, ModuleStoreRefreshState>
): boolean {
	useSubscription(
		trpc.instances.modulesStore.watchRefreshProgress.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => moduleStoreRefreshProgress.clear())
			},
			onData: (info) => {
				runInAction(() => {
					const id = info.moduleInfo ? (`${info.moduleInfo.moduleType}:${info.moduleInfo.moduleId}` as const) : null
					moduleStoreRefreshProgress.set(id, { percent: info.percent, failed: info.failed })
				})
			},
		})
	)

	return true // always ready
}

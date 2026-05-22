import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface RefreshModulesListProps {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const RefreshModuleInfo = observer(function RefreshModuleInfo({
	moduleType,
	moduleId,
}: RefreshModulesListProps) {
	const { moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = moduleStoreRefreshProgress.get(moduleId) ?? 1

	const refreshInfoMutation = useMutationExt(trpc.instances.modulesStore.refreshModuleInfo.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshInfoMutation.mutateAsync({ moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [refreshInfoMutation, moduleType, moduleId])

	if (refreshProgress === 1) {
		return (
			<Button color="primary" onClick={doRefreshModules}>
				<FontAwesomeIcon icon={faSync} />
				&nbsp;Refresh module info
			</Button>
		)
	} else {
		return (
			<Button color="primary" disabled>
				<FontAwesomeIcon icon={faSync} spin={true} />
				&nbsp;Refreshing module info {Math.round(refreshProgress * 100)}%
			</Button>
		)
	}
})

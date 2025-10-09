import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

interface ModuleVersionsRefreshProps {
	modules: ModuleInfoStore
	moduleId: string | null
}
export const ModuleVersionsRefresh = observer(function ModuleVersionsRefresh({
	modules,
	moduleId,
}: ModuleVersionsRefreshProps) {
	const refreshProgress = (moduleId ? modules.storeRefreshProgress.get(moduleId) : null) ?? 1

	const refreshInfoMutation = useMutationExt(trpc.connections.modulesStore.refreshModuleInfo.mutationOptions())
	const doRefreshModules = useCallback(() => {
		if (!moduleId) return
		refreshInfoMutation.mutateAsync({ moduleType: modules.moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module versions', err)
		})
	}, [refreshInfoMutation, modules, moduleId])

	if (refreshProgress === 1) {
		return (
			<div className="float_right" onClick={doRefreshModules}>
				<FontAwesomeIcon icon={faSync} title="Refresh module versions" />
			</div>
		)
	} else {
		return (
			<div className="float_right">
				<FontAwesomeIcon
					icon={faSync}
					spin={true}
					title={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
				/>
			</div>
		)
	}
})

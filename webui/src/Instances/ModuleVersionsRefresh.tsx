import React, { useContext, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

interface ModuleVersionsRefreshProps {
	moduleType: ModuleInstanceType
	moduleId: string | null
}
export const ModuleVersionsRefresh = observer(function ModuleVersionsRefresh({
	moduleType,
	moduleId,
}: ModuleVersionsRefreshProps) {
	const { moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = (moduleId ? moduleStoreRefreshProgress.get(moduleId) : null) ?? 1

	const refreshInfoMutation = useMutationExt(trpc.instances.modulesStore.refreshModuleInfo.mutationOptions())
	const doRefreshModules = useCallback(() => {
		if (!moduleId) return
		refreshInfoMutation.mutateAsync({ moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module versions', err)
		})
	}, [refreshInfoMutation, moduleType, moduleId])

	if (refreshProgress === 1) {
		return (
			<div
				className="float_right"
				onClick={doRefreshModules}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						doRefreshModules()
					}
				}}
				role="button"
				tabIndex={0}
				title="Refresh module versions"
			>
				<FontAwesomeIcon icon={faSync} aria-label="Refresh module versions" />
			</div>
		)
	} else {
		return (
			<div className="float_right" title={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}>
				<FontAwesomeIcon
					icon={faSync}
					spin={true}
					aria-label={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
				/>
			</div>
		)
	}
})

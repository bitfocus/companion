import { useCallback } from 'react'
import React from 'react'
import { CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

interface RefreshModulesListProps {
	modules: ModuleInfoStore
	moduleId: string
}

export const RefreshModuleInfo = observer(function RefreshModuleInfo({ modules, moduleId }: RefreshModulesListProps) {
	const refreshProgress = modules.storeRefreshProgress.get(moduleId) ?? 1

	const refreshInfoMutation = useMutationExt(trpc.connections.modulesStore.refreshModuleInfo.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshInfoMutation.mutateAsync({ moduleType: modules.moduleType, moduleId }).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [refreshInfoMutation, modules, moduleId])

	if (refreshProgress === 1) {
		return (
			<CButton color="primary" onClick={doRefreshModules}>
				<FontAwesomeIcon icon={faSync} />
				&nbsp;Refresh module info
			</CButton>
		)
	} else {
		return (
			<CButton color="primary" disabled>
				<FontAwesomeIcon icon={faSync} spin={true} />
				&nbsp;Refreshing module info {Math.round(refreshProgress * 100)}%
			</CButton>
		)
	}
})

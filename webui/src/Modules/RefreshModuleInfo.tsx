import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import React from 'react'
import { CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface RefreshModulesListProps {
	moduleId: string
}

export const RefreshModuleInfo = observer(function RefreshModuleInfo({ moduleId }: RefreshModulesListProps) {
	const { moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = moduleStoreRefreshProgress.get(moduleId) ?? 1

	const refreshInfoMutation = useMutationExt(trpc.connections.modulesStore.refreshModuleInfo.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshInfoMutation.mutateAsync({ moduleId }).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [refreshInfoMutation, moduleId])

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

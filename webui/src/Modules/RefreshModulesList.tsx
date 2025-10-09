import { useCallback, useState } from 'react'
import React from 'react'
import { CAlert, CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

export const RefreshModulesList = observer(function RefreshModulesList({
	modules,
	btnSize,
}: {
	modules: ModuleInfoStore
	btnSize?: 'sm' | 'lg'
}) {
	const refreshProgress = modules.storeRefreshProgress.get(null) ?? 1

	const [refreshError, setLoadError] = useState<string | null>(null)

	const refreshListMutation = useMutationExt(trpc.instances.modulesStore.refreshList.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshListMutation.mutateAsync({ moduleType: modules.moduleType }).catch((err) => {
			console.error('Failed to refresh modules', err)
			setLoadError('Failed to refresh modules: ' + err)
		})
	}, [refreshListMutation, modules])

	return (
		<div>
			{refreshError ? <CAlert color="warning">{refreshError}</CAlert> : ''}

			{refreshProgress !== 1 ? (
				<CButton color="primary" disabled size={btnSize}>
					<FontAwesomeIcon icon={faSync} spin={true} />
					&nbsp;Refreshing modules list {Math.round(refreshProgress * 100)}%
				</CButton>
			) : (
				<CButton color="primary" onClick={doRefreshModules} size={btnSize}>
					<FontAwesomeIcon icon={faSync} />
					&nbsp;Refresh modules list
				</CButton>
			)}
		</div>
	)
})

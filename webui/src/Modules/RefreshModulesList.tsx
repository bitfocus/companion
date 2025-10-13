import { useCallback, useContext, useState } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import React from 'react'
import { CAlert, CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export const RefreshModulesList = observer(function RefreshModulesList({ btnSize }: { btnSize?: 'sm' | 'lg' }) {
	const { moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = moduleStoreRefreshProgress.get(null) ?? 1

	const [refreshError, setLoadError] = useState<string | null>(null)

	const refreshListMutation = useMutationExt(trpc.instances.modulesStore.refreshList.mutationOptions())

	const doRefreshModules = useCallback(() => {
		refreshListMutation.mutateAsync().catch((err) => {
			console.error('Failed to refresh modules', err)
			setLoadError('Failed to refresh modules: ' + err)
		})
	}, [refreshListMutation])

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

import { useCallback, useContext, useState } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import React from 'react'
import { CAlert, CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'

export const RefreshModulesList = observer(function RefreshModulesList() {
	const { socket, moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = moduleStoreRefreshProgress.get(null) ?? 1

	const [refreshError, setLoadError] = useState<string | null>(null)

	const doRefreshModules = useCallback(() => {
		socket.emitPromise('modules-store:list:refresh', []).catch((err) => {
			console.error('Failed to refresh modules', err)
			setLoadError('Failed to refresh modules: ' + err)
		})
	}, [socket])

	return (
		<div>
			{refreshError ? <CAlert color="warning">{refreshError}</CAlert> : ''}

			{refreshProgress !== 1 ? (
				<CButton color="primary" disabled>
					<FontAwesomeIcon icon={faSync} spin={true} />
					&nbsp;Refreshing modules list {Math.round(refreshProgress * 100)}%
				</CButton>
			) : (
				<CButton color="primary" onClick={doRefreshModules}>
					<FontAwesomeIcon icon={faSync} />
					&nbsp;Refresh modules list
				</CButton>
			)}
		</div>
	)
})

import { useCallback, useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import React from 'react'
import { CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'

interface RefreshModulesListProps {
	moduleId: string
}

export const RefreshModuleInfo = observer(function RefreshModuleInfo({ moduleId }: RefreshModulesListProps) {
	const { socket, moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = moduleStoreRefreshProgress.get(moduleId) ?? 1

	const doRefreshModules = useCallback(() => {
		socket.emitPromise('modules-store:info:refresh', [moduleId]).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [socket])

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

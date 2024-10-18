import { useCallback, useContext, useEffect, useState } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import React from 'react'
import { CAlert, CButton } from '@coreui/react'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { socketEmitPromise } from '../util.js'

export function RefreshModulesList() {
	const { socket } = useContext(RootAppStoreContext)

	const refreshProgress = useRefreshProgress()
	const [refreshError, setLoadError] = useState<string | null>(null) // TODO - show this error

	const doRefreshModules = useCallback(() => {
		socketEmitPromise(socket, 'modules-store:list:refresh', []).catch((err) => {
			console.error('Failed to refresh modules', err)
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
}

function useRefreshProgress(): number {
	// TODO - this needs to subscribe, even when this is not visible...

	const { socket } = useContext(RootAppStoreContext)

	const [refreshProgress, setRefreshProgress] = useState(1) // Assume fully loaded

	useEffect(() => {
		const handler = (progress: number) => {
			setRefreshProgress(progress)
		}

		socket.on('modules-store:list:progress', handler)

		return () => {
			socket.off('modules-store:list:progress', handler)
		}
	}, [socket])

	return refreshProgress
}

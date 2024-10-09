import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport, faQuestionCircle, faSync } from '@fortawesome/free-solid-svg-icons'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import { NewClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { socketEmitPromise, useComputed } from '../util.js'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { NonIdealState } from '../Components/NonIdealState.js'
import { ModuleStoreCacheStore } from '@companion-app/shared/Model/ModulesStore.js'

export const DiscoverVersions = observer(function InstalledModules() {
	const { socket } = useContext(RootAppStoreContext)

	const refreshProgress = useRefreshProgress()
	const moduleStoreCache = useModuleStoreList()

	const doRefreshModules = useCallback(() => {
		socketEmitPromise(socket, 'modules-store:refresh', []).catch((err) => {
			console.error('Failed to refresh modules', err)
		})
	}, [socket])

	const [refreshError, setLoadError] = useState<string | null>(null)
	return (
		<>
			<p>Use the button below to import a custom build of a module.</p>

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
				<p>
					Last updated:{' '}
					{moduleStoreCache ? (moduleStoreCache.lastUpdated === 0 ? 'Never' : moduleStoreCache.lastUpdated) : 'Unknown'}
				</p>
			</div>

			<div className="module-manager-list2">TODO</div>
		</>
	)
})

function useRefreshProgress(): number {
	// TODO - this needs to subscribe, even when this is not visible...

	const { socket } = useContext(RootAppStoreContext)

	const [refreshProgress, setRefreshProgress] = useState(1) // Assume fully loaded

	useEffect(() => {
		const handler = (progress: number) => {
			setRefreshProgress(progress)
		}

		socket.on('modules-store:progress', handler)

		return () => {
			socket.off('modules-store:progress', handler)
		}
	}, [socket])

	return refreshProgress
}

function useModuleStoreList(): ModuleStoreCacheStore | null {
	// TODO - this needs to subscribe, even when this is not visible...

	const { socket } = useContext(RootAppStoreContext)

	const [moduleStoreCache, setModuleStoreCache] = useState<ModuleStoreCacheStore | null>(null)

	useEffect(() => {
		let destroyed = false

		const updateCache = (data: ModuleStoreCacheStore) => {
			if (destroyed) return
			setModuleStoreCache(data)
		}

		socketEmitPromise(socket, 'modules-store:subscribe', [])
			.then(updateCache)
			.catch((err) => {
				console.error('Failed to subscribe to module store', err)
			})

		socket.on('modules-store:data', updateCache)

		return () => {
			destroyed = true
			socket.off('modules-store:data', updateCache)

			socketEmitPromise(socket, 'modules-store:unsubscribe', []).catch((err) => {
				console.error('Failed to unsubscribe to module store', err)
			})
		}
	}, [socket])

	return moduleStoreCache
}

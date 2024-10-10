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
import { ModuleStoreCacheEntry, ModuleStoreCacheStore } from '@companion-app/shared/Model/ModulesStore.js'

export const DiscoverVersions = observer(function InstalledModules() {
	const { socket, modules } = useContext(RootAppStoreContext)

	const refreshProgress = useRefreshProgress()
	const moduleStoreCache = useModuleStoreList()

	const doRefreshModules = useCallback(() => {
		socketEmitPromise(socket, 'modules-store:refresh', []).catch((err) => {
			console.error('Failed to refresh modules', err)
		})
	}, [socket])

	const moduleInfos = Object.values(moduleStoreCache?.modules || {})

	const [refreshError, setLoadError] = useState<string | null>(null)
	return (
		<>
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

			<div className="module-manager-list2">
				{moduleInfos.length === 0 && (
					<NonIdealState icon={faQuestionCircle}>
						Click the refresh button to fetch the list of modules.
						<br /> This requires internet access to retrieve
					</NonIdealState>
				)}

				{moduleInfos.map((moduleInfo) => (
					<ModuleEntry
						key={moduleInfo.id}
						moduleInfo={moduleInfo}
						installedModuleInfo={modules.modules.get(moduleInfo.id)}
					/>
				))}
			</div>
		</>
	)
})

interface ModuleEntryProps {
	moduleInfo: ModuleStoreCacheEntry
	installedModuleInfo: NewClientModuleInfo | undefined
}

const ModuleEntry = observer(function ModuleEntry({ moduleInfo, installedModuleInfo }: ModuleEntryProps) {
	const { socket } = useContext(RootAppStoreContext)

	const installedVersions = new Set<string>()
	if (installedModuleInfo) {
		for (const version of installedModuleInfo.releaseVersions) {
			if (version.version.id) installedVersions.add(version.version.id)
		}
	}

	return (
		<>
			<p>
				{moduleInfo.name} ({moduleInfo.id}) {installedModuleInfo ? 'Installed' : 'Not installed'}
			</p>

			{moduleInfo.versions.map((v) => {
				const isInstalled = installedVersions.has(v.id)
				return (
					<p key={v.id}>
						{v.id} - {v.isPrerelease ? 'prerelease' : 'stable'} {new Date(v.releasedAt).toISOString()}
						<CButton
							color="primary"
							disabled={isInstalled}
							title={isInstalled ? 'Already installed' : ''}
							onClick={() => {
								socketEmitPromise(socket, 'modules:install-store-module', [moduleInfo.id, v.id]).catch((err) => {
									console.error('Failed to install module', err)
								})
							}}
						>
							Install
						</CButton>
					</p>
				)
			})}
			<hr />
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

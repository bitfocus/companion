import React, { useContext, useEffect, useState } from 'react'
import { CRow, CCol, CAlert } from '@coreui/react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreListCacheEntry, ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { WindowLinkOpen } from '../Helpers/Window.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

interface ModuleManagePanelProps {
	moduleId: string
}

export const ModuleManagePanel = observer(function ModuleManagePanel({ moduleId }: ModuleManagePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(moduleId)?.display
	const moduleStoreInfo = modules.storeList.get(moduleId)

	if (!moduleInfo && !moduleStoreInfo) {
		return (
			<CRow className="edit-connection">
				<CCol xs={12}>
					<p>Module not found</p>
				</CCol>
			</CRow>
		)
	}

	return <ModuleManagePanelInner moduleId={moduleId} moduleInfo={moduleInfo} moduleStoreBaseInfo={moduleStoreInfo} />
})

interface ModuleManagePanelInnerProps {
	moduleId: string
	moduleInfo: ModuleDisplayInfo | undefined
	moduleStoreBaseInfo: ModuleStoreListCacheEntry | undefined
}

const ModuleManagePanelInner = observer(function ModuleManagePanelInner({
	moduleId,
	moduleInfo,
	moduleStoreBaseInfo,
}: ModuleManagePanelInnerProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleId)

	const baseInfo = moduleInfo || moduleStoreBaseInfo

	return (
		<div>
			<h5>
				Manage {baseInfo?.name ?? moduleId}
				{!!moduleStoreBaseInfo && (
					<WindowLinkOpen className="float_right" title="Open Store Page" href={moduleStoreBaseInfo.storeUrl}>
						<FontAwesomeIcon icon={faExternalLink} />
					</WindowLinkOpen>
				)}
				{!!moduleStoreBaseInfo?.githubUrl && (
					<WindowLinkOpen className="float_right" title="Open GitHub Page" href={moduleStoreBaseInfo.githubUrl}>
						<FontAwesomeIcon icon={faGithub} />
					</WindowLinkOpen>
				)}
			</h5>

			<div className="refresh-and-last-updated">
				<RefreshModuleInfo moduleId={moduleId} />
				<LastUpdatedTimestamp timestamp={moduleStoreInfo?.lastUpdated} />
			</div>
			{moduleStoreInfo?.updateWarning && <CAlert color="danger">{moduleStoreInfo.updateWarning}</CAlert>}

			<ModuleVersionsTable moduleId={moduleId} moduleStoreInfo={moduleStoreInfo} />
		</div>
	)
})

export function useModuleStoreInfo(moduleId: string | undefined): ModuleStoreModuleInfoStore | null {
	const { socket } = useContext(RootAppStoreContext)

	const [moduleStoreCache, setModuleStoreCache] = useState<ModuleStoreModuleInfoStore | null>(null)

	useEffect(() => {
		if (!moduleId) {
			setModuleStoreCache(null)
			return
		}

		let destroyed = false

		setModuleStoreCache(null)

		socket
			.emitPromise('modules-store:info:subscribe', [moduleId])
			.then((data) => {
				if (destroyed) return
				setModuleStoreCache(data)
			})
			.catch((err) => {
				console.error('Failed to subscribe to module store', err)
			})

		const unsubData = socket.on('modules-store:info:data', (msgModuleId, data) => {
			if (destroyed) return
			if (msgModuleId !== moduleId) return
			setModuleStoreCache(data)
		})

		return () => {
			destroyed = true
			unsubData()

			setModuleStoreCache(null)

			socket.emitPromise('modules-store:info:unsubscribe', [moduleId]).catch((err) => {
				console.error('Failed to unsubscribe to module store', err)
			})
		}
	}, [socket, moduleId])

	return moduleStoreCache
}

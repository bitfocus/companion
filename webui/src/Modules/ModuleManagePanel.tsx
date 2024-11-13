import React, { useContext, useEffect, useState } from 'react'
import { socketEmitPromise } from '../util.js'
import { CRow, CCol, CAlert } from '@coreui/react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type {
	NewClientModuleBaseInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { WindowLinkOpen } from '../Helpers/Window.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

interface ModuleManagePanelProps {
	moduleId: string
	doManageModule: (moduleId: string | null) => void
	showHelp: (moduleId: string, moduleVersion: NewClientModuleVersionInfo2) => void
}

export const ModuleManagePanel = observer(function ModuleManagePanel({
	moduleId,
	doManageModule,
	showHelp,
}: ModuleManagePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(moduleId)?.baseInfo ?? modules.storeList.get(moduleId)

	if (!moduleInfo) {
		return (
			<CRow className="edit-connection">
				<CCol xs={12}>
					<p>Module not found</p>
				</CCol>
			</CRow>
		)
	}

	return (
		<ModuleManagePanelInner
			moduleId={moduleId}
			moduleInfo={moduleInfo}
			doManageModule={doManageModule}
			showHelp={showHelp}
		/>
	)
})

interface ModuleManagePanelInnerProps {
	moduleId: string
	moduleInfo: NewClientModuleBaseInfo
	doManageModule: (moduleId: string | null) => void
	showHelp: (moduleId: string, moduleVersion: NewClientModuleVersionInfo2) => void
}

const ModuleManagePanelInner = observer(function ModuleManagePanelInner({
	moduleId,
	moduleInfo,
	doManageModule,
	showHelp,
}: ModuleManagePanelInnerProps) {
	const { modules } = useContext(RootAppStoreContext)
	const moduleStoreInfo = useModuleStoreInfo(moduleId)

	const moduleStoreBaseInfo = modules.storeList.get(moduleId)

	return (
		<div>
			<h5>
				Manage {moduleInfo.name}
				{/* {moduleVersion?.hasHelp && (
					<div className="float_right" onClick={() => showHelp(connectionInfo.instance_type, moduleVersion)}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)} */}
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

			<ModuleVersionsTable moduleInfo={moduleInfo} moduleStoreInfo={moduleStoreInfo} />
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

		const updateCache = (msgModuleId: string, data: ModuleStoreModuleInfoStore) => {
			if (destroyed) return
			if (msgModuleId !== moduleId) return
			setModuleStoreCache(data)
		}

		socketEmitPromise(socket, 'modules-store:info:subscribe', [moduleId])
			.then((data) => {
				if (destroyed) return
				setModuleStoreCache(data)
			})
			.catch((err) => {
				console.error('Failed to subscribe to module store', err)
			})

		socket.on('modules-store:info:data', updateCache)

		return () => {
			destroyed = true
			socket.off('modules-store:info:data', updateCache)

			setModuleStoreCache(null)

			socketEmitPromise(socket, 'modules-store:info:unsubscribe', [moduleId]).catch((err) => {
				console.error('Failed to unsubscribe to module store', err)
			})
		}
	}, [socket, moduleId])

	return moduleStoreCache
}

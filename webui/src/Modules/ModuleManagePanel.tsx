import React, { useCallback, useContext } from 'react'
import { CRow, CCol, CAlert } from '@coreui/react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink, faTimes } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { useNavigate } from '@tanstack/react-router'

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
	const navigate = useNavigate()

	const baseInfo = moduleInfo || moduleStoreBaseInfo

	const doCloseModule = useCallback(() => {
		void navigate({ to: '/modules' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Manage {baseInfo?.name ?? moduleId}</h4>
				<div className="header-buttons">
					{!!moduleStoreBaseInfo?.githubUrl && (
						<WindowLinkOpen title="Open GitHub Page" href={moduleStoreBaseInfo.githubUrl}>
							<FontAwesomeIcon icon={faGithub} size="xl" />
						</WindowLinkOpen>
					)}
					{!!moduleStoreBaseInfo && (
						<WindowLinkOpen className="ms-1" title="Open Store Page" href={moduleStoreBaseInfo.storeUrl}>
							<FontAwesomeIcon icon={faExternalLink} size="xl" />
						</WindowLinkOpen>
					)}
					<div className="float_right ms-1 d-xl-none" onClick={doCloseModule} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>
			<div className="secondary-panel-simple-body">
				<div className="refresh-and-last-updated">
					<RefreshModuleInfo moduleId={moduleId} />
					<LastUpdatedTimestamp timestamp={moduleStoreInfo?.lastUpdated} />
				</div>
				{moduleStoreInfo?.updateWarning && <CAlert color="danger">{moduleStoreInfo.updateWarning}</CAlert>}

				<ModuleVersionsTable moduleId={moduleId} moduleStoreInfo={moduleStoreInfo} />
			</div>
		</>
	)
})

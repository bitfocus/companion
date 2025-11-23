import React, { useCallback, useContext } from 'react'
import { CRow, CCol, CAlert } from '@coreui/react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink, faTimes } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { useNavigate } from '@tanstack/react-router'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { capitalize } from 'lodash-es'

interface ModuleManagePanelProps {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const ModuleManagePanel = observer(function ModuleManagePanel({ moduleType, moduleId }: ModuleManagePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(moduleType, moduleId)?.display
	const moduleStoreInfo = modules.getStoreInfo(moduleType, moduleId)

	if (!moduleInfo && !moduleStoreInfo) {
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
			moduleType={moduleType}
			moduleId={moduleId}
			moduleInfo={moduleInfo}
			moduleStoreBaseInfo={moduleStoreInfo}
		/>
	)
})

interface ModuleManagePanelInnerProps {
	moduleType: ModuleInstanceType
	moduleId: string
	moduleInfo: ModuleDisplayInfo | undefined
	moduleStoreBaseInfo: ModuleStoreListCacheEntry | undefined
}

const ModuleManagePanelInner = observer(function ModuleManagePanelInner({
	moduleType,
	moduleId,
	moduleInfo,
	moduleStoreBaseInfo,
}: ModuleManagePanelInnerProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)
	const navigate = useNavigate()

	const baseInfo = moduleInfo || moduleStoreBaseInfo

	const doCloseModule = useCallback(() => {
		void navigate({ to: '/modules' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">
					Manage {baseInfo?.name ?? moduleId} ({capitalize(moduleType)})
				</h4>
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
					<RefreshModuleInfo moduleType={moduleType} moduleId={moduleId} />
					<LastUpdatedTimestamp timestamp={moduleStoreInfo?.lastUpdated} />
				</div>
				{moduleStoreInfo?.updateWarning && <CAlert color="danger">{moduleStoreInfo.updateWarning}</CAlert>}

				<ModuleVersionsTable moduleType={moduleType} moduleId={moduleId} moduleStoreInfo={moduleStoreInfo} />
			</div>
		</>
	)
})

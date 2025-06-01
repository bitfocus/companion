import React, { useContext, useEffect } from 'react'
import { CRow, CCol, CAlert } from '@coreui/react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ModuleDisplayInfo, ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleStoreListCacheEntry, ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { useComputed } from '~/util.js'

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
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleStoreVersions(moduleId)
	}, [modules.storeVersions, moduleId])

	if (moduleId) {
		return modules.storeVersions.getModuleStoreVersions(moduleId)
	} else {
		return null
	}
}

export function useModuleUpgradeToVersions(moduleId: string | undefined): ModuleUpgradeToOtherVersion[] {
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleUpgradeToVersions(moduleId)
	}, [modules.storeVersions])

	return useComputed(() => (moduleId ? modules.storeVersions.getModuleUpgradeToVersions(moduleId) : []), [moduleId])
}

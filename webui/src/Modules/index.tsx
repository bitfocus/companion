import { CCol, CRow, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import React, { memo, useCallback, useContext, useEffect, useRef } from 'react'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import { MyErrorBoundary } from '../util.js'
import { ModulesList } from './ModulesList.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleManagePanel } from './ModuleManagePanel.js'
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { NonIdealState } from '../Components/NonIdealState.js'

export const MODULES_PAGE_PREFIX = '/modules'

function useSelectedModuleId(): string | null {
	const routerLocation = useLocation()
	if (!routerLocation.pathname.startsWith(MODULES_PAGE_PREFIX)) return null
	const fragments = routerLocation.pathname.slice(MODULES_PAGE_PREFIX.length + 1).split('/')
	const moduleId = fragments[0]
	if (!moduleId) return null

	return moduleId
}

function navigateToModulePage(navigate: NavigateFunction, controlId: string | null): void {
	if (!controlId) {
		navigate(MODULES_PAGE_PREFIX)
		return
	}

	navigate(`${MODULES_PAGE_PREFIX}/${controlId}`)
}

export const ModulesPage = memo(function ConnectionsPage() {
	const { modules } = useContext(RootAppStoreContext)

	const helpModalRef = useRef<HelpModalRef>(null)

	const selectedModuleId = useSelectedModuleId()
	const activeTab = selectedModuleId ? 'manage' : 'placeholder'
	const navigate = useNavigate()

	// Ensure the selected module is valid
	useEffect(() => {
		if (selectedModuleId && !modules.modules.has(selectedModuleId) && !modules.storeList.has(selectedModuleId)) {
			navigateToModulePage(navigate, null)
		}
	}, [navigate, modules, selectedModuleId])

	const showHelp = useCallback(
		(id: string, moduleVersion: ClientModuleVersionInfo) => helpModalRef.current?.show(id, moduleVersion),
		[]
	)

	const doManageModule = useCallback((moduleId: string | null) => navigateToModulePage(navigate, moduleId), [])

	return (
		<CRow className="connections-page split-panels">
			<HelpModal ref={helpModalRef} />

			<CCol xl={6} className="connections-panel primary-panel">
				<ModulesList showHelp={showHelp} doManageModule={doManageModule} selectedModuleId={selectedModuleId} />
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel add-connections-panel">
				<div className="secondary-panel-inner">
					<CNav variant="tabs">
						<CNavItem>
							<CNavLink active={activeTab === 'placeholder'} onClick={() => navigateToModulePage(navigate, null)}>
								Select a module
							</CNavLink>
						</CNavItem>
						<CNavItem
							className={classNames({
								hidden: !selectedModuleId,
							})}
						>
							<CNavLink active={activeTab === 'manage'} onClick={() => null}>
								<FontAwesomeIcon icon={faCog} /> Manage Module
							</CNavLink>
						</CNavItem>
					</CNav>
					<CTabContent className="remove075right">
						<CTabPane role="tabpanel" aria-labelledby="placeholder-tab" visible={activeTab === 'placeholder'}>
							<MyErrorBoundary>
								<NonIdealState text="Select a module to manage" icon={faPuzzlePiece} />
							</MyErrorBoundary>
						</CTabPane>
						<CTabPane role="tabpanel" aria-labelledby="manage-tab" visible={activeTab === 'manage'}>
							<MyErrorBoundary>
								{selectedModuleId && (
									<ModuleManagePanel
										key={selectedModuleId}
										showHelp={showHelp}
										doManageModule={doManageModule}
										moduleId={selectedModuleId}
									/>
								)}
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent>
				</div>
			</CCol>
		</CRow>
	)
})

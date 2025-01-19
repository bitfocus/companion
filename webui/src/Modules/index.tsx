import { CCol, CRow, CTabContent, CTabPane, CNavItem, CNavLink, CNav } from '@coreui/react'
import React, { memo, useCallback, useContext, useEffect } from 'react'
import { MyErrorBoundary } from '../util.js'
import { ModulesList } from './ModulesList.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { ModuleManagePanel } from './ModuleManagePanel.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { Outlet, useNavigate, UseNavigateResult } from '@tanstack/react-router'

function useSelectedModuleId(): string | null {
	// const routerLocation = useLocation()
	// if (!routerLocation.pathname.startsWith('/modules')) return null
	// const fragments = routerLocation.pathname.slice('/modules'.length + 1).split('/')
	// const moduleId = fragments[0]
	// if (!moduleId) return null

	// return moduleId
	return null
}

function navigateToModulePage(navigate: UseNavigateResult<'/modules'>, moduleId: string | null): void {
	if (!moduleId) {
		navigate({ to: '/modules' })
		return
	}

	navigate({ to: `/modules/${moduleId}` })
}

export const ModulesPage = memo(function ConnectionsPage() {
	const { modules } = useContext(RootAppStoreContext)

	const selectedModuleId = useSelectedModuleId()
	const activeTab = selectedModuleId ? 'manage' : 'placeholder'
	const navigate = useNavigate({ from: '/modules' })

	// Ensure the selected module is valid
	useEffect(() => {
		if (selectedModuleId && !modules.modules.has(selectedModuleId) && !modules.storeList.has(selectedModuleId)) {
			navigateToModulePage(navigate, null)
		}
	}, [navigate, modules, selectedModuleId])

	const doManageModule = useCallback((moduleId: string | null) => navigateToModulePage(navigate, moduleId), [])

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ModulesList doManageModule={doManageModule} selectedModuleId={selectedModuleId} />
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel add-connections-panel">
				<div className="secondary-panel-inner">
					<Outlet />
					{/* <CNav variant="tabs">
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
								{selectedModuleId && <ModuleManagePanel key={selectedModuleId} moduleId={selectedModuleId} />}
							</MyErrorBoundary>
						</CTabPane>
					</CTabContent> */}
				</div>
			</CCol>
		</CRow>
	)
})

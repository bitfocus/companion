import { CCol, CRow } from '@coreui/react'
import React, { memo, useCallback } from 'react'
import { ModulesList, ModuleTypeAndIdPair } from './ModulesList.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'

export const ModulesPage = memo(function ConnectionsPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/modules/$moduleType/$moduleId' })
	const selectedModuleInfo: ModuleTypeAndIdPair | null = routeMatch ? (routeMatch as ModuleTypeAndIdPair) : null

	const navigate = useNavigate({ from: '/modules' })

	const doManageModule = useCallback(
		(moduleInfo: ModuleTypeAndIdPair | null) => {
			if (moduleInfo) {
				void navigate({ to: '/modules/$moduleType/$moduleId', params: moduleInfo })
			} else {
				void navigate({ to: '/modules' })
			}
		},
		[navigate]
	)

	const showPrimaryPanel = !selectedModuleInfo
	const showSecondaryPanel = !!selectedModuleInfo

	return (
		<CRow className="connections-page split-panels">
			<CCol xs={12} xl={6} className={`connections-panel primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'}`}>
				<ModulesList doManageModule={doManageModule} selectedModuleInfo={selectedModuleInfo} />
			</CCol>

			<CCol
				xs={12}
				xl={6}
				className={`connections-panel secondary-panel add-connections-panel ${showSecondaryPanel ? '' : 'd-xl-block d-none'}`}
			>
				<div className="secondary-panel-simple">
					<Outlet />
				</div>
			</CCol>
		</CRow>
	)
})

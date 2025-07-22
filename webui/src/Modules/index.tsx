import { CCol, CRow } from '@coreui/react'
import React, { memo, useCallback } from 'react'
import { ModulesList } from './ModulesList.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'

export const ModulesPage = memo(function ConnectionsPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/modules/$moduleId' })
	const selectedModuleId = routeMatch ? routeMatch.moduleId : null

	const navigate = useNavigate({ from: '/modules' })

	const doManageModule = useCallback(
		(moduleId: string | null) => {
			if (moduleId) {
				void navigate({ to: `/modules/${moduleId}` })
			} else {
				void navigate({ to: '/modules' })
			}
		},
		[navigate]
	)

	const showPrimaryPanel = !selectedModuleId
	const showSecondaryPanel = !!selectedModuleId

	return (
		<CRow className="connections-page split-panels">
			<CCol xs={12} xl={6} className={`connections-panel primary-panel ${showPrimaryPanel ? '' : 'd-xl-block d-none'}`}>
				<ModulesList doManageModule={doManageModule} selectedModuleId={selectedModuleId} />
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

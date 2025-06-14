import { CCol, CRow } from '@coreui/react'
import React, { memo, useCallback } from 'react'
import { ModulesList } from './ModulesList.js'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'

export const ModulesPage = memo(function ConnectionsPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/modules/$moduleId' })

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

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ModulesList doManageModule={doManageModule} selectedModuleId={routeMatch ? routeMatch.moduleId : null} />
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel add-connections-panel">
				<div className="secondary-panel-inner">
					<Outlet />
				</div>
			</CCol>
		</CRow>
	)
})

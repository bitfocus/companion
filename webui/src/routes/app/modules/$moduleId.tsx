import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute, Link } from '@tanstack/react-router'
import React from 'react'
import { ModuleManagePanel } from '../../../Modules/ModuleManagePanel.js'
import { MyErrorBoundary } from '../../../util.js'

export const Route = createFileRoute('/_app/modules/$moduleId')({
	component: RouteComponent,
})

function RouteComponent() {
	const { moduleId } = Route.useParams()

	const navigate = Route.useNavigate()

	return (
		<>
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink onClick={() => navigate({ to: '/modules' })}>Select a module</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink active>
						<FontAwesomeIcon icon={faCog} /> Manage Module
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent className="remove075right">
				<CTabPane role="tabpanel" aria-labelledby="manage-tab" visible>
					<MyErrorBoundary>{moduleId && <ModuleManagePanel key={moduleId} moduleId={moduleId} />}</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
}

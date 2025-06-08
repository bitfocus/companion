import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { ModuleManagePanel } from '~/Modules/ModuleManagePanel.js'
import { MyErrorBoundary, useComputed } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

const RouteComponent = observer(function RouteComponent() {
	const { modules } = useContext(RootAppStoreContext)

	const { moduleId } = Route.useParams()

	const navigate = Route.useNavigate()

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (moduleId && !modules.modules.get(moduleId) && !modules.storeList.has(moduleId)) {
			void navigate({ to: `/modules` })
		}
	}, [navigate, modules, moduleId])

	return (
		<>
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink onClick={() => void navigate({ to: '/modules' })}>Select a module</CNavLink>
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
})

export const Route = createFileRoute('/_app/modules/$moduleId')({
	component: RouteComponent,
})

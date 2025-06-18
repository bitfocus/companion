import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faClock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { EditTriggerPanel } from '~/Triggers/EditPanel.js'
import { MyErrorBoundary, useComputed } from '~/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { observer } from 'mobx-react-lite'

const RouteComponent = observer(function RouteComponent() {
	const { controlId } = Route.useParams()

	const navigate = useNavigate({ from: '/triggers/$controlId' })
	const { triggersList } = useContext(RootAppStoreContext)

	const fullControlId = CreateTriggerControlId(controlId)

	// Ensure the selected trigger is valid
	useComputed(() => {
		if (fullControlId && !triggersList.triggers.get(fullControlId)) {
			void navigate({ to: `/triggers` })
		}
	}, [navigate, triggersList, fullControlId])

	return (
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>
						<FontAwesomeIcon icon={faClock} /> Edit Trigger
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="edit" visible>
					<MyErrorBoundary>
						<EditTriggerPanel key={controlId} controlId={fullControlId} />
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
})

export const Route = createFileRoute('/_app/triggers/$controlId')({
	component: RouteComponent,
})

import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faClock } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '../../../Components/NonIdealState.js'

export const Route = createFileRoute('/_app/triggers/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>Select a trigger</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="placeholder" visible>
					<NonIdealState text="Select a trigger to edit" icon={faClock} />
				</CTabPane>
			</CTabContent>
		</>
	)
}

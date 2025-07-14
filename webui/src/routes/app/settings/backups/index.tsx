import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '../../../../Components/NonIdealState.js'

export const Route = createFileRoute('/_app/settings/backups/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>Select a backup rule</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="placeholder" visible>
					<NonIdealState text="Select a backup rule to edit" icon={faCalendarAlt} />
				</CTabPane>
			</CTabContent>
		</>
	)
}

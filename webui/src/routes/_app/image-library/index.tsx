import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faImage } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'

export const Route = createFileRoute('/_app/image-library/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>Select an image</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="placeholder" visible>
					<NonIdealState text="Select an image to edit" icon={faImage} />
				</CTabPane>
			</CTabContent>
		</>
	)
}

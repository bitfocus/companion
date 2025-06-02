import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { MyErrorBoundary } from '~/util.js'

export const Route = createFileRoute('/_app/modules/')({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<>
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink active>Select a module</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent className="remove075right">
				<CTabPane role="tabpanel" aria-labelledby="placeholder-tab" visible>
					<MyErrorBoundary>
						<NonIdealState text="Select a module to manage" icon={faPuzzlePiece} />
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
}

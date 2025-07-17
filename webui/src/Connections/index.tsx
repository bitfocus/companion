import { CCol, CRow } from '@coreui/react'
import React from 'react'
import { MyErrorBoundary } from '~/util.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'
import { observer } from 'mobx-react-lite'
import { Outlet, useMatchRoute } from '@tanstack/react-router'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/connections/$connectionId' })
	const addConnectionsMatch = matchRoute({ to: '/connections/add' })
	const selectedConnectionId = routeMatch ? routeMatch.connectionId : null

	// On narrow screens, show only one panel at a time
	const showPrimaryPanel = !routeMatch && !addConnectionsMatch
	const showSecondaryPanel = !!routeMatch || !!addConnectionsMatch

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className={`connections-panel primary-panel ${showPrimaryPanel ? 'd-block' : 'd-xl-block d-none'}`}>
				<ConnectionsList selectedConnectionId={selectedConnectionId} />
			</CCol>

			<CCol
				xl={6}
				className={`connections-panel secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-xl-block d-none'}`}
			>
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})

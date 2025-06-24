import { CCol, CRow } from '@coreui/react'
import React from 'react'
import { MyErrorBoundary } from '~/util.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'
import { observer } from 'mobx-react-lite'
import { Outlet, useMatchRoute } from '@tanstack/react-router'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/connections/$connectionId' })
	const selectedConnectionId = routeMatch ? routeMatch.connectionId : null

	return (
		<CRow className="connections-page split-panels">
			<CCol xl={6} className="connections-panel primary-panel">
				<ConnectionsList selectedConnectionId={selectedConnectionId} />
			</CCol>

			<CCol xl={6} className="connections-panel secondary-panel">
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})

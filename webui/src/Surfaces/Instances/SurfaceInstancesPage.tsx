import { CCol, CRow } from '@coreui/react'
import React from 'react'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { observer } from 'mobx-react-lite'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { SurfaceInstancesList } from './SurfaceInstanceList/SurfaceInstanceList'

export const SurfaceInstancesPage = observer(function SurfaceInstancesPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/surfaces/instances/$instanceId' })
	const selectedInstanceId = routeMatch ? routeMatch.instanceId : null

	// On narrow screens, show only one panel at a time
	const showPrimaryPanel = !routeMatch
	const showSecondaryPanel = !!routeMatch

	return (
		<CRow className="surface-instances-page split-panels">
			<CCol
				xl={6}
				className={`surface-instances-panel primary-panel ${showPrimaryPanel ? 'd-block' : 'd-xl-block d-none'}`}
			>
				<MyErrorBoundary>
					<SurfaceInstancesList selectedInstanceId={selectedInstanceId} />
				</MyErrorBoundary>
			</CCol>

			<CCol
				xl={6}
				className={`surface-instance-config-panel secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-xl-block d-none'}`}
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

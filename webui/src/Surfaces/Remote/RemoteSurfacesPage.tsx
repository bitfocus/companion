import { CCol, CRow } from '@coreui/react'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { SurfaceDiscoveryContextProvider } from '../Discovery/SurfaceDiscoveryContext.js'
import { RemoteSurfacesList } from './RemoteSurfaces/RemoteSurfacesList.js'

export const RemoteSurfacesPage = observer(function RemoteSurfacesPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/surfaces/remote/$connectionId' })
	const selectedRemoteConnectionId = routeMatch ? routeMatch.connectionId : null

	// On narrow screens, show only one panel at a time
	const showPrimaryPanel = !routeMatch
	const showSecondaryPanel = !!routeMatch

	return (
		<CRow className="split-panels">
			<CCol xl={6} className={`primary-panel ${showPrimaryPanel ? 'd-block' : 'd-xl-block d-none'}`}>
				<MyErrorBoundary>
					<RemoteSurfacesList selectedRemoteConnectionId={selectedRemoteConnectionId} />
				</MyErrorBoundary>
			</CCol>

			<CCol xl={6} className={`secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-xl-block d-none'}`}>
				<div className="secondary-panel-simple">
					<SurfaceDiscoveryContextProvider>
						<Outlet />
					</SurfaceDiscoveryContextProvider>
				</div>
			</CCol>
		</CRow>
	)
})

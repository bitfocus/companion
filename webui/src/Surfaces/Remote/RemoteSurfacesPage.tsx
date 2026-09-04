import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { SurfaceDiscoveryContextProvider } from '../Discovery/SurfaceDiscoveryContext.js'
import { RemoteSurfacesList } from './RemoteSurfaces/RemoteSurfacesList.js'

export const RemoteSurfacesPage = observer(function RemoteSurfacesPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/surfaces/remote/$connectionId' })
	const selectedRemoteConnectionId = routeMatch ? routeMatch.connectionId : null

	return (
		<SplitPanels.Root showing={routeMatch ? 'secondary' : 'primary'} resize={{ storageKey: 'surfaces-remote' }}>
			<SplitPanels.Primary>
				<MyErrorBoundary>
					<RemoteSurfacesList selectedRemoteConnectionId={selectedRemoteConnectionId} />
				</MyErrorBoundary>
			</SplitPanels.Primary>

			<SplitPanels.Secondary>
				<div className="secondary-panel-simple">
					<SurfaceDiscoveryContextProvider>
						<Outlet />
					</SurfaceDiscoveryContextProvider>
				</div>
			</SplitPanels.Secondary>
		</SplitPanels.Root>
	)
})

import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ConnectionsList } from './ConnectionList/ConnectionList.js'

export const ConnectionsPage = observer(function ConnectionsPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/connections/$connectionId' })
	const addConnectionsMatch = matchRoute({ to: '/connections/add' })
	const selectedConnectionId = routeMatch ? routeMatch.connectionId : null

	return (
		<SplitPanels.Root
			showing={routeMatch || addConnectionsMatch ? 'secondary' : 'primary'}
			className="connections-page"
			resize={{ storageKey: 'connections' }}
		>
			<SplitPanels.Primary className="connections-panel">
				<ConnectionsList selectedConnectionId={selectedConnectionId} />
			</SplitPanels.Primary>

			<SplitPanels.Secondary className="connections-panel">
				<div className="secondary-panel-simple">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</SplitPanels.Secondary>
		</SplitPanels.Root>
	)
})

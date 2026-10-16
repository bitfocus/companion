import { faLink } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddTransportButton } from './AddTransportButton.js'
import { LinkStoreProvider } from './LinkStoreProvider.js'
import { PeersList } from './PeersList.js'
import { TransportsList } from './TransportsList.js'

export const LinkPage = observer(function LinkPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/link/$transportId' })
	const selectedTransportId = routeMatch ? routeMatch.transportId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faLink} title="Link" />

			<LinkStoreProvider>
				<SplitPanels.Root showing={routeMatch ? 'secondary' : 'primary'} resize={{ storageKey: 'link' }}>
					<SplitPanels.Primary>
						<MyErrorBoundary>
							<div className="flex flex-col h-full min-h-0 gap-2">
								<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
									<div>
										<h2 className="text-sm font-semibold mb-1">Companion Link</h2>
										<p className="text-xs text-muted mb-0">
											Link this installation with other Companion installations, so that buttons here can show and press
											buttons over there. Add a transport to say how to reach them.
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<AddTransportButton />
									</div>
								</div>

								<div className="flex-1 min-h-0 scrollable-content list-card">
									<h3 className="text-xs font-semibold uppercase text-muted px-4 pt-3 pb-1">Transports</h3>
									<TransportsList selectedTransportId={selectedTransportId} />

									<h3 className="text-xs font-semibold uppercase text-muted px-4 pt-4 pb-1">Installations</h3>
									<PeersList />
								</div>
							</div>
						</MyErrorBoundary>
					</SplitPanels.Primary>

					<SplitPanels.Secondary>
						<div className="secondary-panel-simple">
							<Outlet />
						</div>
					</SplitPanels.Secondary>
				</SplitPanels.Root>
			</LinkStoreProvider>
		</div>
	)
})

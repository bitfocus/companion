import { faLink, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { LinkButton } from '~/Components/Button.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { AddTransportModal } from './AddTransportModal.js'
import { LinkNav } from './LinkNav.js'
import { LinkStoreProvider } from './LinkStoreProvider.js'
import { TransportsList } from './TransportsList.js'

/** The configured transports: the ways of reaching other installations */
export const LinkTransportsPage = observer(function LinkTransportsPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const addMatch = !!matchRoute({ to: '/link/transports/add' })
	const routeMatch = matchRoute({ to: '/link/transports/$transportId' })
	const selectedTransportId = routeMatch && routeMatch.transportId !== 'add' ? routeMatch.transportId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faLink} title="Link" />

			<LinkNav />

			<LinkStoreProvider>
				<SplitPanels.Root
					showing={selectedTransportId ? 'secondary' : 'primary'}
					resize={{ storageKey: 'link-transports' }}
				>
					<SplitPanels.Primary>
						<MyErrorBoundary>
							<div className="flex flex-col h-full min-h-0 gap-2">
								<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
									<p className="text-xs text-muted mb-0">
										Transports are how this installation reaches the others. An installation reachable on more than one
										of them keeps working if one fails.
									</p>
									<div>
										<LinkButton to="/link/transports/add" color="primary" size="sm">
											<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Add Transport
										</LinkButton>
									</div>
								</div>

								<div className="flex-1 min-h-0 scrollable-content list-card">
									<TransportsList selectedTransportId={selectedTransportId} />
								</div>
							</div>
						</MyErrorBoundary>
					</SplitPanels.Primary>

					<SplitPanels.Secondary>
						<div className="secondary-panel-simple">
							<MyErrorBoundary>
								<Outlet />
							</MyErrorBoundary>
						</div>
					</SplitPanels.Secondary>
				</SplitPanels.Root>

				<AddTransportModal open={addMatch} />
			</LinkStoreProvider>
		</div>
	)
})

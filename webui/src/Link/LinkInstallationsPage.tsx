import { faLink } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LinkNav } from './LinkNav.js'
import { PeersList } from './PeersList.js'
import { AttentionSections } from './TransportSections.js'

/** The other installations found on the transports, and what is shared with each */
export const LinkInstallationsPage = observer(function LinkInstallationsPage(): React.JSX.Element {
	const matchRoute = useMatchRoute()
	const selfSelected = !!matchRoute({ to: '/link/self' })
	const routeMatch = matchRoute({ to: '/link/$peerId' })
	const selectedPeerId = routeMatch && !selfSelected ? routeMatch.peerId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faLink} title="Link" />

			<LinkNav />

			<SplitPanels.Root
				showing={selectedPeerId || selfSelected ? 'secondary' : 'primary'}
				resize={{ storageKey: 'link-installations' }}
			>
				<SplitPanels.Primary>
					<MyErrorBoundary>
						<div className="flex flex-col h-full min-h-0 gap-2">
							<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg shrink-0">
								<h2 className="text-sm font-semibold mb-1">Companion Link</h2>
								<p className="text-xs text-muted mb-0">
									Link this installation with other Companion installations, so that buttons here can show and press
									buttons over there. The installations found on the transports are listed here, with what is shared
									with each.
								</p>
							</div>

							<AttentionSections />

							<div className="flex-1 min-h-0 scrollable-content list-card">
								<PeersList selectedPeerId={selectedPeerId} selfSelected={selfSelected} />
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
		</div>
	)
})

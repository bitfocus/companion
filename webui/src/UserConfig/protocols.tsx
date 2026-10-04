import { faCog } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { PROTOCOLS } from './ProtocolDefinitions.js'
import { SettingsItemsList } from './SettingsItems.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsProtocolsPage = observer(function UserConfig() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/protocols/$protocolId' })
	const selectedProtocolId = routeMatch ? routeMatch.protocolId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#protocols" />

			<SettingsNav activeTab="protocols" />

			<SplitPanels.Root showing={selectedProtocolId ? 'secondary' : 'primary'} resize={{ storageKey: 'protocols' }}>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg shrink-0">
							<p className="text-xs text-muted mb-0">
								Network endpoints for controlling Companion remotely. Select one to change its settings or find its API
								reference.
							</p>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card p-2">
							<SettingsItemsList items={PROTOCOLS} selectedId={selectedProtocolId} basePath="/settings/protocols" />
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

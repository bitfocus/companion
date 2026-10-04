import { faCog } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { ADVANCED_ITEMS } from './AdvancedDefinitions.js'
import { SettingsItemsList } from './SettingsItems.js'
import { SettingsNav } from './SettingsNav.js'

export const SettingsAdvancedPage = observer(function UserConfig() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/settings/advanced/$itemId' })
	const selectedItemId = routeMatch ? routeMatch.itemId : null

	return (
		<div className="page-shell">
			<PageHeader icon={faCog} title="Settings" helpAction="/user-guide/config/settings#advanced" />

			<SettingsNav activeTab="advanced" />

			<SplitPanels.Root showing={selectedItemId ? 'secondary' : 'primary'} resize={{ storageKey: 'advanced' }}>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg shrink-0">
							<p className="text-xs text-muted mb-0">
								Admin authentication, HTTPS certificates, and experimental features. Select one to change its settings.
							</p>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card p-2">
							<SettingsItemsList items={ADVANCED_ITEMS} selectedId={selectedItemId} basePath="/settings/advanced" />
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

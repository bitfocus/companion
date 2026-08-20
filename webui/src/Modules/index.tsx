import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { memo, useCallback } from 'react'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { ModulesList, type ModuleTypeAndIdPair } from './ModulesList.js'

export const ModulesPage = memo(function ConnectionsPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/modules/$moduleType/$moduleId' })
	const selectedModuleInfo: ModuleTypeAndIdPair | null = routeMatch ? (routeMatch as ModuleTypeAndIdPair) : null

	const navigate = useNavigate({ from: '/modules' })

	const doManageModule = useCallback(
		(moduleInfo: ModuleTypeAndIdPair | null) => {
			if (moduleInfo) {
				void navigate({ to: '/modules/$moduleType/$moduleId', params: moduleInfo })
			} else {
				void navigate({ to: '/modules' })
			}
		},
		[navigate]
	)

	return (
		<SplitPanels.Root
			showing={selectedModuleInfo ? 'secondary' : 'primary'}
			className="connections-page"
			resize={{ storageKey: 'modules' }}
		>
			<SplitPanels.Primary className="connections-panel">
				<ModulesList doManageModule={doManageModule} selectedModuleInfo={selectedModuleInfo} />
			</SplitPanels.Primary>

			<SplitPanels.Secondary className="connections-panel add-connections-panel">
				<div className="secondary-panel-simple">
					<Outlet />
				</div>
			</SplitPanels.Secondary>
		</SplitPanels.Root>
	)
})

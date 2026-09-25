import { faBoxes } from '@fortawesome/free-solid-svg-icons'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { memo, useCallback } from 'react'
import { PageHeader } from '~/Layout/PageHeader.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ModulesList, type ModuleTypeAndIdPair } from './ModulesList.js'

export const ModulesPage = memo(function ModulesPage() {
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
		<div className="page-shell">
			<PageHeader icon={faBoxes} title="Modules Manager" helpAction="/user-guide/config/modules" />

			<SplitPanels.Root showing={selectedModuleInfo ? 'secondary' : 'primary'} resize={{ storageKey: 'modules' }}>
				<SplitPanels.Primary>
					<ModulesList doManageModule={doManageModule} selectedModuleInfo={selectedModuleInfo} />
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

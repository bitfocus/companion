import { faGithub } from '@fortawesome/free-brands-svg-icons'
import './modules-manage.css'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Grid } from '~/Components/Grid'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { ModuleVersionsTable } from './ModuleVersionsTable.js'
import { RefreshModuleInfo } from './RefreshModuleInfo.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'

interface ModuleManagePanelProps {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const ModuleManagePanel = observer(function ModuleManagePanel({ moduleType, moduleId }: ModuleManagePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(moduleType, moduleId)?.display
	const moduleStoreInfo = modules.getStoreInfo(moduleType, moduleId)

	if (!moduleInfo && !moduleStoreInfo) {
		return (
			<Grid.Row className="edit-connection">
				<Grid.Col xs={12}>
					<p>Module not found</p>
				</Grid.Col>
			</Grid.Row>
		)
	}

	return (
		<ModuleManagePanelInner
			moduleType={moduleType}
			moduleId={moduleId}
			moduleInfo={moduleInfo}
			moduleStoreBaseInfo={moduleStoreInfo}
		/>
	)
})

interface ModuleManagePanelInnerProps {
	moduleType: ModuleInstanceType
	moduleId: string
	moduleInfo: ModuleDisplayInfo | undefined
	moduleStoreBaseInfo: ModuleStoreListCacheEntry | undefined
}

const ModuleManagePanelInner = observer(function ModuleManagePanelInner({
	moduleType,
	moduleId,
	moduleInfo,
	moduleStoreBaseInfo,
}: ModuleManagePanelInnerProps) {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)
	const navigate = useNavigate()

	const baseInfo = moduleInfo || moduleStoreBaseInfo

	const doCloseModule = useCallback(() => {
		void navigate({ to: '/modules' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header panel-header-compact">
				<div className="flex items-center gap-2 min-w-0 pr-16">
					<span className="module-type-chip">{capitalize(moduleType)}</span>
					<h3 className="text-base font-bold truncate text-body mb-0">{baseInfo?.name ?? moduleId}</h3>
				</div>

				<div className="flex items-center gap-2 pr-8">
					{!!moduleStoreBaseInfo?.githubUrl && (
						<WindowLinkOpen
							title="Open GitHub Page"
							href={moduleStoreBaseInfo.githubUrl}
							className="text-muted hover:text-body text-xs p-1"
						>
							<FontAwesomeIcon icon={faGithub} className="text-sm" />
						</WindowLinkOpen>
					)}
					{!!moduleStoreBaseInfo && (
						<WindowLinkOpen
							className="text-muted hover:text-body text-xs p-1"
							title="Open Store Page"
							href={moduleStoreBaseInfo.storeUrl}
						>
							<FontAwesomeIcon icon={faExternalLink} className="text-sm" />
						</WindowLinkOpen>
					)}
				</div>

				<CloseButton closeFn={doCloseModule} className="absolute top-2.5 right-3" />
			</div>

			<div className="secondary-panel-simple-body p-4 space-y-4 overflow-y-auto flex-1">
				<div className="flex items-center justify-between gap-2 text-xs text-muted">
					<RefreshModuleInfo moduleType={moduleType} moduleId={moduleId} />
					<LastUpdatedTimestamp timestamp={moduleStoreInfo?.lastUpdated} />
				</div>
				{moduleStoreInfo?.updateWarning && <StaticAlert color="danger">{moduleStoreInfo.updateWarning}</StaticAlert>}

				<ModuleVersionsTable moduleType={moduleType} moduleId={moduleId} moduleStoreInfo={moduleStoreInfo} />
			</div>
		</>
	)
})

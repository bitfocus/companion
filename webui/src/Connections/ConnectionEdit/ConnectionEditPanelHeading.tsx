import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceTableStatusCell } from '~/Instances/List/InstanceTableStatusCell.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfo } from '../../Instances/Util.js'

interface ConnectionEditPanelHeadingProps {
	connectionInfo: ClientConnectionConfig
	closeConfigurePanel: () => void
}

export const ConnectionEditPanelHeading = observer(function ConnectionEditPanelHeading({
	connectionInfo,
	closeConfigurePanel,
}: ConnectionEditPanelHeadingProps) {
	const { modules, instanceStatuses } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(connectionInfo.moduleType, connectionInfo.moduleId)
	const moduleVersion = getModuleVersionInfo(moduleInfo, connectionInfo.moduleVersionId)
	const status = instanceStatuses.getStatus(connectionInfo.id)

	return (
		<div className="secondary-panel-simple-header panel-header-compact panel-header-stacked">
			<div className="flex items-center gap-2.5 min-w-0 pr-8">
				<h3 className="text-base font-bold truncate text-body mb-0">{connectionInfo.label}</h3>
				<InstanceTableStatusCell isEnabled={connectionInfo.enabled !== false} status={status} />
			</div>

			<div className="flex items-center gap-1.5 text-xs text-muted truncate pr-8">
				<span className="font-medium text-body">{moduleInfo?.display?.name ?? connectionInfo.moduleId}</span>
				<span>•</span>
				<span>{moduleVersion?.displayName ?? connectionInfo.moduleVersionId}</span>
			</div>

			<CloseButton closeFn={closeConfigurePanel} className="absolute top-2.5 right-3" />
		</div>
	)
})

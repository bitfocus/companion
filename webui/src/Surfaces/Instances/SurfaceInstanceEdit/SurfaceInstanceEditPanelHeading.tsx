import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/SurfaceInstance.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface SurfaceInstanceEditPanelHeadingProps {
	instanceInfo: ClientSurfaceInstanceConfig
	closeConfigurePanel: () => void
}

export const SurfaceInstanceEditPanelHeading = observer(function SurfaceInstanceEditPanelHeading({
	instanceInfo,
	closeConfigurePanel,
}: SurfaceInstanceEditPanelHeadingProps) {
	const { helpViewer, modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(instanceInfo.moduleType, instanceInfo.moduleId)
	const moduleVersion = getModuleVersionInfo(moduleInfo, instanceInfo.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(
				ModuleInstanceType.Surface,
				instanceInfo.moduleId,
				moduleVersion.versionId,
				moduleVersion.helpPath
			),
		[helpViewer, instanceInfo.moduleId, moduleVersion]
	)

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Surface Integration: {moduleInfo?.display?.name ?? instanceInfo.moduleId}</h4>
			<div className="header-buttons">
				{moduleVersion?.helpPath && (
					<ContextHelpButton action={doShowHelp}>
						Change properties of the surface integration here. Click the icon to show instructions for this module.
					</ContextHelpButton>
				)}
				<CloseButton closeFn={closeConfigurePanel} />
			</div>
		</div>
	)
})

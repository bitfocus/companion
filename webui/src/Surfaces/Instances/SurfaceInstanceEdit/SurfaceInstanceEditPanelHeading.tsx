import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/SurfaceInstance.js'

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
			<h4 className="panel-title">Edit Surface Instance: {moduleInfo?.display?.name ?? instanceInfo.moduleId}</h4>
			<div className="header-buttons">
				{moduleVersion?.helpPath && (
					<div className="float_right" onClick={doShowHelp} title="Show help for this module">
						<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
					</div>
				)}
				<div className="float_right ms-1" onClick={closeConfigurePanel} title="Close">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</div>
			</div>
		</div>
	)
})

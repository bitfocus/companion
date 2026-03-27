import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfo } from '../../Instances/Util.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons.js'

interface ConnectionEditPanelHeadingProps {
	connectionInfo: ClientConnectionConfig
	closeConfigurePanel: () => void
}

export const ConnectionEditPanelHeading = observer(function ConnectionEditPanelHeading({
	connectionInfo,
	closeConfigurePanel,
}: ConnectionEditPanelHeadingProps) {
	const { helpViewer, modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.getModuleInfo(connectionInfo.moduleType, connectionInfo.moduleId)
	const moduleVersion = getModuleVersionInfo(moduleInfo, connectionInfo.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(
				ModuleInstanceType.Connection,
				connectionInfo.moduleId,
				moduleVersion.versionId,
				moduleVersion.helpPath
			),
		[helpViewer, connectionInfo.moduleId, moduleVersion]
	)

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Connection: {moduleInfo?.display?.name ?? connectionInfo.moduleId}</h4>
			<div className="header-buttons">
				{moduleVersion?.helpPath && (
					<ContextHelpButton action={doShowHelp}>
						Change properties of the connection here. Click the icon to show instructions for this module.
					</ContextHelpButton>
				)}
				<CloseButton closeFn={closeConfigurePanel} />
			</div>
		</div>
	)
})

import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfo } from '../../Instances/Util.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

interface ConnectionEditPanelHeadingProps {
	connectionInfo: ClientConnectionConfig
	closeConfigurePanel: () => void
}

export const ConnectionEditPanelHeading = observer(function ConnectionEditPanelHeading({
	connectionInfo,
	closeConfigurePanel,
}: ConnectionEditPanelHeadingProps) {
	const { helpViewer, modules } = useContext(RootAppStoreContext)

	const moduleInfo = modules.modules.get(connectionInfo.moduleId)
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
					<div className="float_right" onClick={doShowHelp} title="Show help for this connection">
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

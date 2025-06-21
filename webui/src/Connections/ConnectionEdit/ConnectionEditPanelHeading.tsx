import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfoForConnection } from '../Util.js'

interface ConnectionEditPanelHeadingProps {
	connectionInfo: ClientConnectionConfig
	moduleInfo: ClientModuleInfo | undefined
	closeConfigurePanel: () => void
}

export const ConnectionEditPanelHeading = observer(function ConnectionEditPanelHeading({
	connectionInfo,
	moduleInfo,
	closeConfigurePanel,
}: ConnectionEditPanelHeadingProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connectionInfo.moduleVersionId)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(connectionInfo.instance_type, moduleVersion.versionId, moduleVersion.helpPath),
		[helpViewer, connectionInfo.instance_type, moduleVersion]
	)

	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Connection: {moduleInfo?.display?.shortname ?? connectionInfo.instance_type}</h4>
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

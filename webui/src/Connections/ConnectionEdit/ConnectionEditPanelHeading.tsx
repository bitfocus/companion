import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getModuleVersionInfoForConnection } from '../Util.js'

interface ConnectionEditPanelHeadingProps {
	connectionInfo: ClientConnectionConfig
	moduleInfo: ClientModuleInfo | undefined
}

export const ConnectionEditPanelHeading = observer(function ConnectionEditPanelHeading({
	connectionInfo,
	moduleInfo,
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
		<h5>
			{moduleInfo?.display?.shortname ?? connectionInfo.instance_type} configuration
			{moduleVersion?.helpPath && (
				<div className="float_right" onClick={doShowHelp}>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</div>
			)}
		</h5>
	)
})

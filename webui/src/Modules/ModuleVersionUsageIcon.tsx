import { faPlug, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React from 'react'

interface ModuleVersionUsageIconProps {
	matchingConnections: number
	isInstalled: boolean
}

export const ModuleVersionUsageIcon = observer(function ModuleVersionUsageIcon({
	matchingConnections,
	isInstalled,
}: ModuleVersionUsageIconProps) {
	if (matchingConnections === 0) return null // TODO - needs a placeholder for positioning

	return (
		<FontAwesomeIcon
			icon={isInstalled ? faPlug : faWarning}
			title={`${matchingConnections} connections are using this version`}
		/>
	)
})

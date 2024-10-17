import { faPlug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { ConnectionsContext } from '../util.js'

interface ModuleVersionUsageIconProps {
	moduleId: string
	moduleVersionMode: 'specific-version' | 'custom'
	moduleVersionId: string | null
	isLatestStable: boolean
	isLatestPrerelease: boolean
}

export const ModuleVersionUsageIcon = observer(function ModuleVersionUsageIcon({
	moduleId,
	moduleVersionMode,
	moduleVersionId,
	isLatestStable,
	isLatestPrerelease,
}: ModuleVersionUsageIconProps) {
	const connections = useContext(ConnectionsContext)

	let matchingConnections = 0
	for (const connection of Object.values(connections)) {
		if (connection.instance_type !== moduleId) continue

		if (
			connection.moduleVersionMode === moduleVersionMode &&
			moduleVersionId &&
			connection.moduleVersionId === moduleVersionId
		) {
			matchingConnections++
		} else if (connection.moduleVersionMode === 'stable' && isLatestStable) {
			matchingConnections++
		} else if (connection.moduleVersionMode === 'prerelease' && isLatestPrerelease) {
			matchingConnections++
		}
	}

	if (matchingConnections === 0) return null // TODO - needs a placeholder for positioning

	return <FontAwesomeIcon icon={faPlug} title={`${matchingConnections} connections are using this version`} />
})

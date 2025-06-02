import { faPlug, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ModuleVersionUsageIconProps {
	moduleId: string
	moduleVersionId: string
	isInstalled: boolean
}

export const ModuleVersionUsageIcon = observer(function ModuleVersionUsageIcon({
	moduleId,
	moduleVersionId,
	isInstalled,
}: ModuleVersionUsageIconProps) {
	const { connections } = useContext(RootAppStoreContext)

	let matchingConnections = 0
	for (const connection of connections.connections.values()) {
		if (connection.instance_type !== moduleId) continue

		if (moduleVersionId && connection.moduleVersionId === moduleVersionId) {
			matchingConnections++
		}
	}

	if (matchingConnections === 0) return null // TODO - needs a placeholder for positioning

	return (
		<FontAwesomeIcon
			icon={isInstalled ? faPlug : faWarning}
			title={`${matchingConnections} connections are using this version`}
		/>
	)
})

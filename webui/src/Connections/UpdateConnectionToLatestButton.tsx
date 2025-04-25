import React from 'react'
import { observer } from 'mobx-react-lite'
import { useModuleStoreInfo, useModuleUpgradeToVersions } from '../Modules/ModuleManagePanel.js'
import { getLatestVersion } from './ConnectionEdit/VersionUtil.js'
import semver from 'semver'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { faCircleUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface UpdateConnectionToLatestButtonProps {
	connection: ClientConnectionConfig
}

export const UpdateConnectionToLatestButton = observer(function UpdateConnectionToLatestButton({
	connection,
}: UpdateConnectionToLatestButtonProps) {
	// Don't show for dev versions
	if (connection.moduleVersionId === 'dev') return null
	// Return early if manual updates are enabled
	if (connection.updatePolicy === 'manual') return null

	return <UpdateConnectionToLatestButtonInner connection={connection} />
})

const UpdateConnectionToLatestButtonInner = observer(function ModuleVersionInfoInner({
	connection,
}: UpdateConnectionToLatestButtonProps) {
	const moduleStoreInfo = useModuleStoreInfo(connection.instance_type) // TODO - put these into a central store, to minimise the impact
	const upgradeToVersions = useModuleUpgradeToVersions(connection.instance_type)

	let message: string | undefined

	if (upgradeToVersions.length > 0 && connection.updatePolicy !== 'manual') {
		message = 'A replacement for this module is available'
	} else {
		const latestStableVersion = getLatestVersion(moduleStoreInfo?.versions, false)
		const latestBetaVersion = getLatestVersion(moduleStoreInfo?.versions, true)

		let latestVersion: string | null = connection.moduleVersionId

		// Use the latest stable if newer than the current version, for both modes
		if (latestStableVersion && (!latestVersion || semver.gt(latestStableVersion.id, latestVersion))) {
			latestVersion = latestStableVersion.id
		}

		// If update policy allows beta versions, and there is a newer beta version, use that
		if (
			connection.updatePolicy === 'beta' &&
			latestBetaVersion &&
			(!latestVersion || semver.gt(latestBetaVersion.id, latestVersion))
		) {
			latestVersion = latestBetaVersion.id
		}

		// If no match was found, or it matched the current version, hide the icon
		if (latestVersion && latestVersion !== connection.moduleVersionId) {
			message = `Module version v${latestVersion} is available`
		}
	}

	if (!message) return null

	return (
		<>
			&nbsp;
			<FontAwesomeIcon icon={faCircleUp} title={message} />
		</>
	)
})

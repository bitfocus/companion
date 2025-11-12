import React from 'react'
import { observer } from 'mobx-react-lite'
import { useModuleStoreInfo } from '~/Modules/useModuleStoreInfo.js'
import { useModuleUpgradeToVersions } from '~/Modules/useModuleUpgradeToVersions.js'
import { getLatestVersion } from './VersionUtil.js'
import semver from 'semver'
import { InstanceVersionUpdatePolicy, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import { faCircleUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface UpdateInstanceToLatestBadgeProps {
	instance: ClientInstanceConfigBase
}

export const UpdateInstanceToLatestBadge = observer(function UpdateInstanceToLatestBadge({
	instance,
}: UpdateInstanceToLatestBadgeProps) {
	// Don't show for dev versions
	if (instance.moduleVersionId === 'dev') return null
	// Return early if manual updates are enabled
	if (instance.updatePolicy === InstanceVersionUpdatePolicy.Manual) return null

	return <UpdateInstanceToLatestBadgeInner instance={instance} />
})

const UpdateInstanceToLatestBadgeInner = observer(function UpdateInstanceToLatestBadgeInner({
	instance,
}: UpdateInstanceToLatestBadgeProps) {
	const moduleStoreInfo = useModuleStoreInfo(instance.moduleType, instance.moduleId) // TODO - put these into a central store, to minimise the impact
	const upgradeToVersions = useModuleUpgradeToVersions(instance.moduleType, instance.moduleId)

	let message: string | undefined

	try {
		if (upgradeToVersions.length > 0 && instance.updatePolicy !== InstanceVersionUpdatePolicy.Manual) {
			message = 'A replacement for this module is available'
		} else {
			const latestStableVersion = getLatestVersion(moduleStoreInfo?.versions, false)
			const latestBetaVersion = getLatestVersion(moduleStoreInfo?.versions, true)

			let latestVersion: string | null = instance.moduleVersionId

			// Use the latest stable if newer than the current version, for both modes
			if (latestStableVersion && (!latestVersion || semver.gt(latestStableVersion.id, latestVersion))) {
				latestVersion = latestStableVersion.id
			}

			// If update policy allows beta versions, and there is a newer beta version, use that
			if (
				instance.updatePolicy === InstanceVersionUpdatePolicy.Beta &&
				latestBetaVersion &&
				(!latestVersion || semver.gt(latestBetaVersion.id, latestVersion))
			) {
				latestVersion = latestBetaVersion.id
			}

			// If no match was found, or it matched the current version, hide the icon
			if (latestVersion && latestVersion !== instance.moduleVersionId) {
				message = `Module version v${latestVersion} is available`
			}
		}
	} catch (_e) {
		// Ignore invalid
	}

	if (!message) return null

	return (
		<>
			&nbsp;
			<FontAwesomeIcon icon={faCircleUp} title={message} />
		</>
	)
})

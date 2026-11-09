import semver from 'semver'
import { InstanceVersionUpdatePolicy, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { getLatestVersion } from './VersionUtil.js'

/** Shared by the row badge and collection counts so they agree about available updates. */
export function getInstanceUpdateMessage(
	instance: ClientInstanceConfigBase,
	versions: ModuleStoreModuleInfoVersion[] | undefined,
	hasReplacement: boolean
): string | undefined {
	if (instance.moduleVersionId === 'dev') return undefined
	let message: string | undefined

	try {
		if (hasReplacement && instance.updatePolicy !== InstanceVersionUpdatePolicy.Manual) {
			message = 'A replacement for this module is available'
		} else {
			const latestStableVersion = getLatestVersion(instance.moduleType, versions, false)
			const latestBetaVersion = getLatestVersion(instance.moduleType, versions, true)

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

	return message
}

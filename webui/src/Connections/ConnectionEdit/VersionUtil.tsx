import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import semver from 'semver'

export function doesConnectionVersionExist(
	moduleInfo: ClientModuleInfo | undefined,
	versionId: string | null
): boolean {
	if (versionId === null) return false
	if (versionId === 'dev') return !!moduleInfo?.devVersion

	return !!moduleInfo?.installedVersions.find((v) => v.versionId === versionId)
}

export function getLatestVersion(
	versions: ModuleStoreModuleInfoVersion[] | undefined,
	isBeta: boolean,
	skipCompatibleCheck = false
): ModuleStoreModuleInfoVersion | null {
	let latest: ModuleStoreModuleInfoVersion | null = null
	for (const version of versions || []) {
		if (!version || (version.releaseChannel === 'beta') !== isBeta) continue
		if ((!skipCompatibleCheck && !isModuleApiVersionCompatible(version.apiVersion)) || version.deprecationReason)
			continue
		if (!latest || semver.compare(version.id, latest.id, { loose: true }) > 0) {
			latest = version
		}
	}

	return latest
}

import semver from 'semver'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'

export function doesInstanceVersionExist(moduleInfo: ClientModuleInfo | undefined, versionId: string | null): boolean {
	if (versionId === null) return false
	if (versionId === 'dev') return !!moduleInfo?.devVersion
	if (versionId === 'builtin') return !!moduleInfo?.builtinVersion

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

/**
 * The latest stable and beta store versions that the version selector offers to install, alongside the installed versions
 */
export function getStoreInstallChoices(
	installedInfo: ClientModuleInfo | null | undefined,
	latestStableVersion: ModuleStoreModuleInfoVersion | null,
	latestBetaVersion: ModuleStoreModuleInfoVersion | null,
	includeBeta: boolean
): ModuleStoreModuleInfoVersion[] {
	const isListed = (version: ModuleStoreModuleInfoVersion) =>
		!!installedInfo?.installedVersions.some((v) => v.versionId === version.id && (includeBeta || !v.isBeta))

	const choices: ModuleStoreModuleInfoVersion[] = []

	if (
		latestStableVersion &&
		!isListed(latestStableVersion) &&
		(!installedInfo?.stableVersion ||
			semver.compare(latestStableVersion.id, installedInfo.stableVersion.versionId, { loose: true }) > 0)
	) {
		choices.push(latestStableVersion)
	}

	if (
		includeBeta &&
		latestBetaVersion &&
		!isListed(latestBetaVersion) &&
		(!installedInfo?.betaVersion ||
			semver.compare(latestBetaVersion.id, installedInfo.betaVersion.versionId, { loose: true }) > 0)
	) {
		choices.push(latestBetaVersion)
	}

	return choices
}

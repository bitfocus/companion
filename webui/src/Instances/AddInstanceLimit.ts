import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { getLatestVersion, getStoreInstallChoices } from './VersionUtil.js'

/**
 * Whether a new instance of a surface module cannot be added because of allowMultipleInstances.
 * The configure step offers every installed version plus the latest store versions, so this only blocks when none of
 * those could allow multiples.
 */
export function isSurfaceInstanceLimitReached(
	installedInfo: ClientModuleInfo | null | undefined,
	storeInfo: ModuleStoreModuleInfoStore | null,
	existingInstanceCount: number
): boolean {
	if (existingInstanceCount === 0) return false

	const selectableVersions = [
		installedInfo?.devVersion,
		installedInfo?.builtinVersion,
		...(installedInfo?.installedVersions ?? []),
	].filter((v) => !!v)
	if (selectableVersions.length === 0) return false
	if (selectableVersions.some((v) => v.allowMultipleInstances)) return false

	// Store versions don't expose their manifest, so an offered one might allow multiples. The server checks the
	// selected version's manifest when adding, and creates the instance disabled if it doesn't
	const storeChoices = getStoreInstallChoices(
		installedInfo,
		getLatestVersion(ModuleInstanceType.Surface, storeInfo?.versions, false),
		getLatestVersion(ModuleInstanceType.Surface, storeInfo?.versions, true),
		true
	)
	return storeChoices.length === 0
}

import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'

/**
 * Whether a new instance of a surface module cannot be added because of allowMultipleInstances.
 * The configure step offers every installed version, so this only blocks when none of them allows multiples.
 */
export function isSurfaceInstanceLimitReached(
	installedInfo: ClientModuleInfo | null | undefined,
	existingInstanceCount: number
): boolean {
	if (existingInstanceCount === 0) return false

	const selectableVersions = [
		installedInfo?.devVersion,
		installedInfo?.builtinVersion,
		...(installedInfo?.installedVersions ?? []),
	].filter((v) => !!v)
	if (selectableVersions.length === 0) return false

	return !selectableVersions.some((v) => v.allowMultipleInstances)
}

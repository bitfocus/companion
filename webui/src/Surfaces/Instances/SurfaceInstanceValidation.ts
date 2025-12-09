import type { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/SurfaceInstance.js'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

export interface CanEnableSurfaceInstanceResult {
	ok: boolean
	reason?: string
}

/**
 * Check if a surface instance can be enabled based on allowMultipleInstances manifest property
 */
function canEnableSurfaceInstance(
	surfaceInstanceId: string,
	instance: ClientSurfaceInstanceConfig,
	allInstances: Map<string, ClientSurfaceInstanceConfig>,
	moduleInfoStore: ModuleInfoStore
): string | null {
	// Get the module info to check allowMultipleInstances
	const moduleInfo = moduleInfoStore.getModuleInfo(ModuleInstanceType.Surface, instance.moduleId)
	if (!moduleInfo) {
		return `Multiple instances of this module cannot be enabled at once`
	}

	// Find the version info
	let versionInfo = null
	if (instance.moduleVersionId === moduleInfo.devVersion?.versionId) {
		versionInfo = moduleInfo.devVersion
	} else if (instance.moduleVersionId === moduleInfo.builtinVersion?.versionId) {
		versionInfo = moduleInfo.builtinVersion
	} else if (instance.moduleVersionId === moduleInfo.stableVersion?.versionId) {
		versionInfo = moduleInfo.stableVersion
	} else if (instance.moduleVersionId === moduleInfo.betaVersion?.versionId) {
		versionInfo = moduleInfo.betaVersion
	} else {
		versionInfo = moduleInfo.installedVersions.find((v) => v.versionId === instance.moduleVersionId)
	}

	if (!versionInfo) {
		return `Multiple instances of "${moduleInfo.display.name}" cannot be enabled at once`
	}

	// Find all enabled instances of this module (including the one we're checking)
	const enabledInstances = []
	for (const [otherId, otherInstance] of allInstances.entries()) {
		if (otherInstance.moduleId !== instance.moduleId) continue
		if (!otherInstance.enabled && otherId !== surfaceInstanceId) continue

		enabledInstances.push({ id: otherId, instance: otherInstance })
	}

	// If this would be the only instance, it's always allowed
	if (enabledInstances.length <= 1) {
		return null
	}

	// Check if ALL versions in use (or would be in use) allow multiple instances
	for (const { id, instance } of enabledInstances) {
		const checkVersionId = id === surfaceInstanceId ? instance.moduleVersionId : instance.moduleVersionId

		// Find the version info for this instance
		let checkVersionInfo = null
		if (checkVersionId === moduleInfo.devVersion?.versionId) {
			checkVersionInfo = moduleInfo.devVersion
		} else if (checkVersionId === moduleInfo.builtinVersion?.versionId) {
			checkVersionInfo = moduleInfo.builtinVersion
		} else if (checkVersionId === moduleInfo.stableVersion?.versionId) {
			checkVersionInfo = moduleInfo.stableVersion
		} else if (checkVersionId === moduleInfo.betaVersion?.versionId) {
			checkVersionInfo = moduleInfo.betaVersion
		} else {
			checkVersionInfo = moduleInfo.installedVersions.find((v) => v.versionId === checkVersionId)
		}

		if (!checkVersionInfo) continue

		// If ANY version doesn't allow multiple instances, multiple instances are not allowed
		const allowMultiple = checkVersionInfo.allowMultipleInstances ?? false
		if (!allowMultiple) {
			return `Multiple instances of "${moduleInfo.display.name}" cannot be enabled at once`
		}
	}

	return null
}

/**
 * Get the reason why a surface instance cannot be enabled, if any
 */
export function getSurfaceInstanceCannotEnableReason(
	surfaceInstanceId: string,
	allInstances: Map<string, ClientSurfaceInstanceConfig>,
	moduleInfoStore: ModuleInfoStore
): string | null {
	const instance = allInstances.get(surfaceInstanceId)
	if (!instance) return null

	// Only check for disabled instances
	if (instance.enabled) return null

	return canEnableSurfaceInstance(surfaceInstanceId, instance, allInstances, moduleInfoStore)
}

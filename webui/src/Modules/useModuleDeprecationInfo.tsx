import { useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useModuleUpgradeToVersions } from './useModuleUpgradeToVersions.js'

export interface ModuleDeprecationInfo {
	/** The explanation the store gave for the deprecation, when it gave one */
	reason: string | null
	/** Names of the modules the store offers as a replacement for this one */
	replacementNames: string[]
}

/**
 * Whether the store considers a module deprecated, and what it offers instead.
 * Returns null while the module is not known to be deprecated.
 */
export function useModuleDeprecationInfo(
	moduleType: ModuleInstanceType | undefined,
	moduleId: string | undefined
): ModuleDeprecationInfo | null {
	const { modules } = useContext(RootAppStoreContext)

	const upgradeToVersions = useModuleUpgradeToVersions(moduleType, moduleId)

	return useComputed(() => {
		if (!moduleType || !moduleId) return null

		const storeInfo = modules.getStoreInfo(moduleType, moduleId)
		if (!storeInfo?.deprecationReason) return null

		return {
			reason: storeInfo.deprecationReason,
			replacementNames: upgradeToVersions.map((version) => version.displayName),
		}
	}, [modules, moduleType, moduleId, upgradeToVersions])
}

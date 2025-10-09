import type { ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import { useEffect } from 'react'
import { useComputed } from '~/Resources/util'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

export function useModuleUpgradeToVersions(
	modules: ModuleInfoStore,
	moduleId: string | undefined
): ModuleUpgradeToOtherVersion[] {
	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleUpgradeToVersions(moduleId)
	}, [modules.storeVersions, moduleId])

	return useComputed(() => (moduleId ? modules.storeVersions.getModuleUpgradeToVersions(moduleId) : []), [moduleId])
}

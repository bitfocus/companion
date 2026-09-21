import { useContext, useEffect } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useModuleUpgradeToVersions(
	moduleType: ModuleInstanceType | undefined,
	moduleId: string | undefined
): ModuleUpgradeToOtherVersion[] {
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleType || !moduleId) return

		return modules.storeVersions.subscribeToModuleUpgradeToVersions(moduleType, moduleId)
	}, [modules, moduleType, moduleId])

	return useComputed(
		() => (moduleType && moduleId ? modules.storeVersions.getModuleUpgradeToVersions(moduleType, moduleId) : []),
		[modules, moduleType, moduleId]
	)
}

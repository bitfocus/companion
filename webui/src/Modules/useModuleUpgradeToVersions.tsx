import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import { useContext, useEffect } from 'react'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useModuleUpgradeToVersions(
	moduleType: ModuleInstanceType,
	moduleId: string | undefined
): ModuleUpgradeToOtherVersion[] {
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleUpgradeToVersions(moduleType, moduleId)
	}, [modules, moduleType, moduleId])

	return useComputed(
		() => (moduleId ? modules.storeVersions.getModuleUpgradeToVersions(moduleType, moduleId) : []),
		[moduleId]
	)
}

import type { ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import { useContext, useEffect } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { useComputed } from '~/Resources/util'

export function useModuleUpgradeToVersions(moduleId: string | undefined): ModuleUpgradeToOtherVersion[] {
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleUpgradeToVersions(moduleId)
	}, [modules.storeVersions, moduleId])

	return useComputed(() => (moduleId ? modules.storeVersions.getModuleUpgradeToVersions(moduleId) : []), [moduleId])
}

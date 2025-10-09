import type { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { useEffect } from 'react'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

export function useModuleStoreInfo(
	modules: ModuleInfoStore,
	moduleId: string | undefined
): ModuleStoreModuleInfoStore | null {
	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleStoreVersions(moduleId)
	}, [modules.storeVersions, moduleId])

	if (moduleId) {
		return modules.storeVersions.getModuleStoreVersions(moduleId)
	} else {
		return null
	}
}

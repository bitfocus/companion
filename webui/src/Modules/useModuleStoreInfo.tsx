import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { useContext, useEffect } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useModuleStoreInfo(
	moduleType: ModuleInstanceType,
	moduleId: string | undefined
): ModuleStoreModuleInfoStore | null {
	const { modules } = useContext(RootAppStoreContext)

	useEffect(() => {
		if (!moduleId) return

		return modules.storeVersions.subscribeToModuleStoreVersions(moduleType, moduleId)
	}, [modules, moduleType, moduleId])

	if (moduleId) {
		return modules.storeVersions.getModuleStoreVersions(moduleType, moduleId)
	} else {
		return null
	}
}

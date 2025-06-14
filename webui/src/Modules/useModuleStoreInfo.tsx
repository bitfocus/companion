import { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { useContext, useEffect } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useModuleStoreInfo(moduleId: string | undefined): ModuleStoreModuleInfoStore | null {
	const { modules } = useContext(RootAppStoreContext)

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

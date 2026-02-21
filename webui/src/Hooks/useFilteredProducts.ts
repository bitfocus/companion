import { useComputed } from '~/Resources/util.js'
import { go as fuzzySearch } from 'fuzzysort'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export function useAllModuleProducts(
	onlyModuleType: ModuleInstanceType | null,
	includeUnreleased?: boolean,
	includeDeprecated?: boolean
): FuzzyProduct[] {
	const { modules } = useContext(RootAppStoreContext)

	return useComputed(() => {
		const allProducts: Record<string, FuzzyProduct> = {}

		// Start with all installed modules

		for (const moduleInfo of modules.allModules.values()) {
			if (onlyModuleType && moduleInfo.moduleType !== onlyModuleType) continue

			const latestVersion =
				moduleInfo.stableVersion ?? moduleInfo.betaVersion ?? moduleInfo.builtinVersion ?? moduleInfo.devVersion
			if (!latestVersion) continue // shouldn't happen, but just in case

			for (const product of moduleInfo.display.products) {
				const key = `${moduleInfo.moduleType}-${moduleInfo.display.id}-${product}`
				allProducts[key] = {
					moduleType: moduleInfo.moduleType,
					moduleId: moduleInfo.display.id,

					installedInfo: moduleInfo,
					storeInfo: null,

					product,
					keywords: moduleInfo.display.keywords?.join(';') ?? '',
					name: moduleInfo.display.name,
					shortname: moduleInfo.display.shortname,

					bugUrl: moduleInfo.display.bugUrl,
					helpUrl: latestVersion?.helpPath,
				}
			}
		}

		// Add in the store modules
		for (const moduleInfo of modules.storeList.values()) {
			if (onlyModuleType && moduleInfo.moduleType !== onlyModuleType) continue

			// If there is no help URL, it has no stable version and should often be hidden
			if (!includeUnreleased && !moduleInfo.helpUrl) continue
			// If we are hiding deprecated modules, skip these
			if (!includeDeprecated && moduleInfo.deprecationReason) continue

			for (const product of moduleInfo.products) {
				const key = `${moduleInfo.moduleType}-${moduleInfo.id}-${product}`

				const installedInfo = allProducts[key]
				if (installedInfo) {
					installedInfo.storeInfo = moduleInfo
				} else {
					allProducts[key] = {
						moduleType: moduleInfo.moduleType,
						moduleId: moduleInfo.id,

						installedInfo: null,
						storeInfo: moduleInfo,

						product,
						keywords: moduleInfo.keywords?.join(';') ?? '',
						name: moduleInfo.name,
						shortname: moduleInfo.shortname,

						bugUrl: moduleInfo.githubUrl ?? undefined,
						helpUrl: moduleInfo.helpUrl ?? undefined,
					}
				}
			}
		}

		return Object.values(allProducts)
	}, [modules, includeUnreleased])
}

export function filterProducts(allProducts: FuzzyProduct[], filter: string, includeType: boolean): FuzzyProduct[] {
	if (!filter) return allProducts //.map((p) => p.info)

	const keys: Array<keyof FuzzyProduct> = ['product', 'name', 'keywords']
	if (includeType) keys.push('moduleType')

	const result = fuzzySearch(filter, allProducts, {
		keys,
		// threshold is 0 - 1, where 1 is "perfect".
		// But note that even exact word matches may not get a score of 1!
		// ("Elgato", for example scores 0.8 - 0.9. -- you may need the whole field to match for 1.0...)
		threshold: 0.3, // tolerates some typos; 0.5 looks like a good "strict" threshold.
	})
	return result.map((x) => x.obj)
}

export interface FuzzyProduct {
	moduleType: ModuleInstanceType
	moduleId: string

	installedInfo: ClientModuleInfo | null
	storeInfo: ModuleStoreListCacheEntry | null

	product: string
	keywords: string
	name: string
	shortname: string

	bugUrl: string | undefined
	helpUrl: string | undefined
}

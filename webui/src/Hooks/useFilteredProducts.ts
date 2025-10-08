import { useComputed } from '~/Resources/util.js'
import { go as fuzzySearch } from 'fuzzysort'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import type { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'

export function useAllConnectionProducts(
	modules: ModuleInfoStore,
	includeUnreleased?: boolean,
	includeDeprecated?: boolean
): FuzzyProduct[] {
	return useComputed(() => {
		const allProducts: Record<string, FuzzyProduct> = {}

		// Start with all installed modules
		for (const moduleInfo of modules.modules.values()) {
			const latestVersion = moduleInfo.stableVersion ?? moduleInfo.betaVersion ?? moduleInfo.devVersion
			if (!latestVersion) continue // shouldn't happen, but just in case

			for (const product of moduleInfo.display.products) {
				const key = `${moduleInfo.display.id}-${product}`
				allProducts[key] = {
					id: moduleInfo.display.id,

					installedInfo: moduleInfo,
					storeInfo: null,

					product,
					keywords: moduleInfo.display.keywords?.join(';') ?? '',
					name: moduleInfo.display.name,
					manufacturer: moduleInfo.display.manufacturer,
					shortname: moduleInfo.display.shortname,

					bugUrl: moduleInfo.display.bugUrl,
					helpUrl: latestVersion?.helpPath,
				}
			}
		}

		// Add in the store modules
		for (const moduleInfo of modules.storeList.values()) {
			// If there is no help URL, it has no stable version and should often be hidden
			if (!includeUnreleased && !moduleInfo.helpUrl) continue
			// If we are hiding deprecated modules, skip these
			if (!includeDeprecated && moduleInfo.deprecationReason) continue

			for (const product of moduleInfo.products) {
				const key = `${moduleInfo.id}-${product}`

				const installedInfo = allProducts[key]
				if (installedInfo) {
					installedInfo.storeInfo = moduleInfo
				} else {
					allProducts[key] = {
						id: moduleInfo.id,

						installedInfo: null,
						storeInfo: moduleInfo,

						product,
						keywords: moduleInfo.keywords?.join(';') ?? '',
						name: moduleInfo.name,
						manufacturer: moduleInfo.manufacturer,
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

export function filterProducts(allProducts: FuzzyProduct[], filter: string): FuzzyProduct[] {
	if (!filter) return allProducts //.map((p) => p.info)

	return fuzzySearch(filter, allProducts, {
		keys: ['product', 'name', 'manufacturer', 'keywords'] satisfies Array<keyof FuzzyProduct>,
		threshold: -10_000,
	}).map((x) => x.obj)
}

export interface FuzzyProduct {
	id: string

	installedInfo: ClientModuleInfo | null
	storeInfo: ModuleStoreListCacheEntry | null

	product: string
	keywords: string
	name: string
	manufacturer: string
	shortname: string

	bugUrl: string | undefined
	helpUrl: string | undefined
}

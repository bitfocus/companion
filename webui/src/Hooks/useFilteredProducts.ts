import { useComputed } from '../util.js'
import { go as fuzzySearch } from 'fuzzysort'
import { NewClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { useContext } from 'react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'

export interface ModuleProductInfo extends NewClientModuleInfo {
	product: string
}

interface FuzzyProduct {
	info: ModuleProductInfo

	product: string
	keywords: string
	name: string
	manufacturer: string
}

export function useFilteredProducts(filter: string): ModuleProductInfo[] {
	const { modules } = useContext(RootAppStoreContext)

	const allProducts: FuzzyProduct[] = useComputed(
		() =>
			Array.from(modules.modules.values()).flatMap((moduleInfo) =>
				moduleInfo.baseInfo.products.map(
					(product) =>
						({
							info: {
								...moduleInfo,
								product,
							},

							product,
							// fuzzySearch can't handle arrays, so flatten the array to a string first
							keywords: moduleInfo.baseInfo.keywords?.join(';') ?? '',
							name: moduleInfo.baseInfo.name,
							manufacturer: moduleInfo.baseInfo.manufacturer,
						}) satisfies FuzzyProduct
				)
			),
		[modules]
	)

	if (!filter) return allProducts.map((p) => p.info)

	return fuzzySearch(filter, allProducts, {
		keys: ['product', 'name', 'manufacturer', 'keywords'] satisfies Array<keyof FuzzyProduct>,
		threshold: -10_000,
	}).map((x) => x.obj.info)
}

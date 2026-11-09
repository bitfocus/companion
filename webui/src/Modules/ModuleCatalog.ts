import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import type { FuzzyProduct } from '~/Hooks/useFilteredProducts.js'

export interface ModuleProducts {
	manufacturer: string | null
	/** Product names without the manufacturer; empty when the module declares none */
	products: string[]
}

/** A module's manufacturer and products, combining its installed and store info. */
export function getModuleProducts(
	installed: ModuleDisplayInfo | null | undefined,
	store: ModuleStoreListCacheEntry | null | undefined
): ModuleProducts {
	return {
		manufacturer: installed?.manufacturer ?? store?.manufacturer ?? null,
		products: [...new Set([...(installed?.products ?? []), ...(store?.products ?? [])])],
	}
}

/** "Manufacturer: Product", the form a product is listed and searched by. */
export function formatModuleProduct(manufacturer: string | null, product: string): string {
	return manufacturer ? `${manufacturer}: ${product}` : product
}

/** Each product with its listed label; a module declaring none is listed by its name. */
export function getModuleProductEntries(
	{ manufacturer, products }: ModuleProducts,
	moduleName: string
): Array<{ product: string; label: string }> {
	if (products.length === 0) return [{ product: moduleName, label: moduleName }]
	return products.map((product) => ({ product, label: formatModuleProduct(manufacturer, product) }))
}

function getModuleCatalogName(module: FuzzyProduct): string {
	return module.installedInfo?.display.name ?? module.storeInfo?.name ?? module.name
}

/** The title of a module's catalog row, under its manufacturer's heading. */
export function getModuleProductName(module: FuzzyProduct): string {
	const { products } = getModuleProducts(module.installedInfo?.display, module.storeInfo)
	return products.length > 0 ? products.join('; ') : getModuleCatalogName(module)
}

/** Keep the best search match per module, then group both catalog browsers consistently. */
export function groupModuleCatalog(
	products: FuzzyProduct[],
	searching: boolean
): [string, { name: string; modules: FuzzyProduct[] }][] {
	const unique = new Map<string, FuzzyProduct>()
	for (const module of products) {
		const key = `${module.moduleType}:${module.moduleId}`
		if (!unique.has(key)) unique.set(key, module)
	}
	const groups = new Map<string, { name: string; modules: FuzzyProduct[] }>()
	for (const module of unique.values()) {
		const name = module.manufacturer ?? 'Other'
		const key = name.toLocaleLowerCase()
		let group = groups.get(key)
		if (!group) {
			group = { name, modules: [] }
			groups.set(key, group)
		}
		group.modules.push(module)
	}
	// Search results arrive best match first, so insertion order ranks each group by its best match
	if (searching) return Array.from(groups.entries())

	for (const group of groups.values()) {
		group.modules.sort((a, b) => getModuleProductName(a).localeCompare(getModuleProductName(b)))
	}
	return Array.from(groups.entries()).sort(([a], [b]) => {
		if (a === b) return 0
		if (a === 'other') return 1
		if (b === 'other') return -1
		return a.localeCompare(b)
	})
}

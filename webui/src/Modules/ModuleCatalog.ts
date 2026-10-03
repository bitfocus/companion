import type { FuzzyProduct } from '~/Hooks/useFilteredProducts.js'

export function getModuleCatalogName(module: FuzzyProduct): string {
	return module.installedInfo?.display.name ?? module.storeInfo?.name ?? module.name
}

export function getModuleManufacturer(module: FuzzyProduct): string {
	const name = getModuleCatalogName(module)
	const colon = name.indexOf(':')
	return colon > 0 ? name.slice(0, colon).trim() : 'Other'
}

export function getModuleProductName(module: FuzzyProduct): string {
	const name = getModuleCatalogName(module)
	const colon = name.indexOf(':')
	return (colon > 0 ? name.slice(colon + 1).trim() : name.trim()) || name
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
		const name = getModuleManufacturer(module)
		const key = name.toLocaleLowerCase()
		let group = groups.get(key)
		if (!group) {
			group = { name, modules: [] }
			groups.set(key, group)
		}
		group.modules.push(module)
	}
	if (!searching) {
		for (const group of groups.values()) {
			group.modules.sort((a, b) => getModuleProductName(a).localeCompare(getModuleProductName(b)))
		}
	}
	return Array.from(groups.entries()).sort(([a], [b]) => {
		if (a === b) return 0
		if (a === 'other') return 1
		if (b === 'other') return -1
		return a.localeCompare(b)
	})
}

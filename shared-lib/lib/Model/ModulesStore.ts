export interface ModuleStoreCacheEntry {
	id: string
	name: string
	manufacturer: string
	products: string[]
	keywords: string[]
	versions: ModuleStoreCacheVersionEntry[]

	// TODO - more props
}
export interface ModuleStoreCacheVersionEntry {
	id: string
	isPrerelease: boolean
	releasedAt: number // unix timestamp

	// TODO - more props
}

export interface ModuleStoreCacheStore {
	lastUpdated: number
	modules: Record<string, ModuleStoreCacheEntry>
}

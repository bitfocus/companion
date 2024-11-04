export interface ModuleStoreListCacheStore {
	lastUpdated: number
	lastUpdateAttempt: number
	updateWarning: string | null

	modules: Record<string, ModuleStoreListCacheEntry>
}

export interface ModuleStoreListCacheEntry {
	id: string
	name: string
	manufacturer: string
	shortname: string
	products: string[]
	keywords: string[]

	storeUrl: string
	githubUrl: string | null

	deprecationReason: string | null

	// description: string | null

	// licenseSPDX: string
	// isPaid

	// Platform support?
	// Has compatible version?

	// TODO - more props
}

export interface ModuleStoreModuleInfoStore {
	id: string

	lastUpdated: number
	lastUpdateAttempt: number
	updateWarning: string | null

	// TODO
	versions: ModuleStoreModuleInfoVersion[]
}
export interface ModuleStoreModuleInfoVersion {
	id: string
	isPrerelease: boolean
	releasedAt: number // unix timestamp

	tarUrl: string | null
	deprecationReason: string | null

	apiVersion: string

	// TODO - more props
}

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
	helpUrl: string | null

	legacyIds: string[]
	deprecationReason: string | null

	// description: string | null

	// licenseSPDX: string
	// isPaid

	// Platform support?
	// Has compatible version?
}

export interface ModuleStoreModuleInfoStore {
	id: string

	lastUpdated: number
	lastUpdateAttempt: number
	updateWarning: string | null

	versions: ModuleStoreModuleInfoVersion[]
}
export interface ModuleStoreModuleInfoVersion {
	id: string
	releaseChannel: 'stable' | 'beta'
	releasedAt: number // unix timestamp

	tarUrl: string | null
	tarSha: string | null
	deprecationReason: string | null

	apiVersion: string

	helpUrl: string | null
}

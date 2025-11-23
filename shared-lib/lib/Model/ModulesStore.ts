import type { ModuleInstanceType } from './Instance.js'

export interface ModuleStoreListCacheStore {
	lastUpdated: number
	lastUpdateAttempt: number
	updateWarning: string | null

	// The version of the module API that the check was made with. Note: this may not exist for older cache data
	connectionModuleApiVersion: string | null
	connectionModules: Record<string, ModuleStoreListCacheEntry> | null

	surfaceModuleApiVersion: string | null
	surfaceModules: Record<string, ModuleStoreListCacheEntry> | null
}

export interface ModuleStoreListCacheEntry {
	id: string
	name: string
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
	moduleType: ModuleInstanceType

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

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import type { ModuleStoreListCacheEntryExt } from '~/Stores/ModuleInfoStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { useAllModuleProducts } from '../useFilteredProducts.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVersion(versionId = '1.0.0'): ClientModuleVersionInfo {
	return {
		displayName: `v${versionId}`,
		isLegacy: false,
		isBeta: false,
		helpPath: `/help/${versionId}`,
		versionId,
		allowMultipleInstances: false,
	}
}

function makeInstalledModule(
	id: string,
	products: string[],
	moduleType = ModuleInstanceType.Connection,
	versionOverrides: Partial<
		Pick<ClientModuleInfo, 'devVersion' | 'builtinVersion' | 'stableVersion' | 'betaVersion'>
	> = {}
): ClientModuleInfo {
	return {
		moduleType,
		display: {
			id,
			name: `Module ${id}`,
			helpPath: '/help',
			bugUrl: 'https://bugs.example.com',
			shortname: id,
			products,
			keywords: ['kw1', 'kw2'],
		},
		devVersion: null,
		builtinVersion: null,
		stableVersion: makeVersion(),
		betaVersion: null,
		installedVersions: [],
		...versionOverrides,
	}
}

function makeStoreEntry(
	id: string,
	products: string[],
	moduleType = ModuleInstanceType.Connection,
	overrides: Partial<ModuleStoreListCacheEntry> = {}
): ModuleStoreListCacheEntryExt {
	return {
		id,
		moduleType,
		name: `Store ${id}`,
		shortname: id,
		products,
		keywords: ['store-kw'],
		storeUrl: 'https://store.example.com',
		githubUrl: 'https://github.com/example',
		helpUrl: 'https://help.example.com',
		legacyIds: [],
		deprecationReason: null,
		...overrides,
	}
}

function makeModules(
	allModules: Map<string, ClientModuleInfo> = new Map(),
	storeList: Map<string, ModuleStoreListCacheEntryExt> = new Map()
): RootAppStore {
	return { modules: { allModules, storeList } } as unknown as RootAppStore
}

function renderHookWithStore(store: RootAppStore, hook: () => ReturnType<typeof useAllModuleProducts>) {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<RootAppStoreContext.Provider value={store}>{children}</RootAppStoreContext.Provider>
	)
	return renderHook(hook, { wrapper })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAllModuleProducts', () => {
	describe('empty stores', () => {
		it('returns empty array when both stores are empty', () => {
			const store = makeModules()
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))
			expect(result.current).toEqual([])
		})
	})

	describe('installed modules', () => {
		it('returns a FuzzyProduct per product of an installed module', () => {
			const mod = makeInstalledModule('bmd-atem', ['ATEM Mini', 'ATEM Mini Pro'])
			const store = makeModules(new Map([['connection:bmd-atem', mod]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(2)
			expect(result.current[0].product).toBe('ATEM Mini')
			expect(result.current[1].product).toBe('ATEM Mini Pro')
		})

		it('populates FuzzyProduct fields from the installed module', () => {
			const mod = makeInstalledModule('bmd-atem', ['ATEM Mini'])
			const store = makeModules(new Map([['connection:bmd-atem', mod]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			const [p] = result.current
			expect(p.moduleType).toBe(ModuleInstanceType.Connection)
			expect(p.moduleId).toBe('bmd-atem')
			expect(p.installedInfo).toBe(mod)
			expect(p.storeInfo).toBeNull()
			expect(p.name).toBe('Module bmd-atem')
			expect(p.shortname).toBe('bmd-atem')
			expect(p.keywords).toBe('kw1;kw2')
			expect(p.bugUrl).toBe('https://bugs.example.com')
			expect(p.helpUrl).toBe('/help/1.0.0') // from stableVersion.helpPath
		})

		it('uses devVersion helpPath as helpUrl when devVersion is set', () => {
			const dev = makeVersion('dev')
			dev.helpPath = '/help/dev'
			const mod = makeInstalledModule('my-mod', ['Product'], ModuleInstanceType.Connection, {
				devVersion: dev,
				stableVersion: null,
			})
			const store = makeModules(new Map([['connection:my-mod', mod]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current[0].helpUrl).toBe('/help/dev')
		})

		it('skips modules that have no version at all', () => {
			const mod = makeInstalledModule('no-version-mod', ['Product'], ModuleInstanceType.Connection, {
				devVersion: null,
				builtinVersion: null,
				stableVersion: null,
				betaVersion: null,
			})
			const store = makeModules(new Map([['connection:no-version-mod', mod]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(0)
		})
	})

	describe('store modules', () => {
		it('returns FuzzyProducts from the store list', () => {
			const entry = makeStoreEntry('bmd-atem', ['ATEM Mini'])
			const store = makeModules(new Map(), new Map([['connection:bmd-atem', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(1)
			const [p] = result.current
			expect(p.moduleType).toBe(ModuleInstanceType.Connection)
			expect(p.moduleId).toBe('bmd-atem')
			expect(p.installedInfo).toBeNull()
			expect(p.storeInfo).toBe(entry)
			expect(p.name).toBe('Store bmd-atem')
			expect(p.keywords).toBe('store-kw')
			expect(p.helpUrl).toBe('https://help.example.com')
			expect(p.bugUrl).toBe('https://github.com/example')
		})

		it('excludes store modules with no helpUrl by default (unreleased)', () => {
			const entry = makeStoreEntry('unreleased-mod', ['Product'], ModuleInstanceType.Connection, {
				helpUrl: null,
			})
			const store = makeModules(new Map(), new Map([['connection:unreleased-mod', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(0)
		})

		it('includes store modules with no helpUrl when includeUnreleased=true', () => {
			const entry = makeStoreEntry('unreleased-mod', ['Product'], ModuleInstanceType.Connection, {
				helpUrl: null,
			})
			const store = makeModules(new Map(), new Map([['connection:unreleased-mod', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null, true))

			expect(result.current).toHaveLength(1)
		})

		it('excludes deprecated store modules by default', () => {
			const entry = makeStoreEntry('old-mod', ['Product'], ModuleInstanceType.Connection, {
				deprecationReason: 'Use new-mod instead',
			})
			const store = makeModules(new Map(), new Map([['connection:old-mod', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(0)
		})

		it('includes deprecated store modules when includeDeprecated=true', () => {
			const entry = makeStoreEntry('old-mod', ['Product'], ModuleInstanceType.Connection, {
				deprecationReason: 'Use new-mod instead',
			})
			const store = makeModules(new Map(), new Map([['connection:old-mod', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null, false, true))

			expect(result.current).toHaveLength(1)
		})
	})

	describe('merging installed and store modules', () => {
		it('sets storeInfo on an existing installed entry when both share the same id+product key', () => {
			const mod = makeInstalledModule('bmd-atem', ['ATEM Mini'])
			const entry = makeStoreEntry('bmd-atem', ['ATEM Mini'])
			const store = makeModules(new Map([['connection:bmd-atem', mod]]), new Map([['connection:bmd-atem', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(1)
			const [p] = result.current
			expect(p.installedInfo).toBe(mod)
			expect(p.storeInfo).toBe(entry)
		})

		it('creates separate entries when products do not overlap', () => {
			const mod = makeInstalledModule('bmd-atem', ['ATEM Mini'])
			const entry = makeStoreEntry('bmd-atem', ['ATEM Mini Pro'])
			const store = makeModules(new Map([['connection:bmd-atem', mod]]), new Map([['connection:bmd-atem', entry]]))
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(null))

			expect(result.current).toHaveLength(2)
			const installed = result.current.find((p) => p.product === 'ATEM Mini')!
			const storeOnly = result.current.find((p) => p.product === 'ATEM Mini Pro')!

			expect(installed.installedInfo).toBe(mod)
			expect(installed.storeInfo).toBeNull()
			expect(storeOnly.installedInfo).toBeNull()
			expect(storeOnly.storeInfo).toBe(entry)
		})
	})

	describe('onlyModuleType filter', () => {
		it('only returns Connection modules when onlyModuleType=Connection', () => {
			const conn = makeInstalledModule('conn-mod', ['ConnProduct'], ModuleInstanceType.Connection)
			const surf = makeInstalledModule('surf-mod', ['SurfProduct'], ModuleInstanceType.Surface)
			const store = makeModules(
				new Map([
					['connection:conn-mod', conn],
					['surface:surf-mod', surf],
				])
			)
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(ModuleInstanceType.Connection))

			expect(result.current).toHaveLength(1)
			expect(result.current[0].moduleType).toBe(ModuleInstanceType.Connection)
		})

		it('filters store list modules by onlyModuleType', () => {
			const connEntry = makeStoreEntry('conn-mod', ['ConnProduct'], ModuleInstanceType.Connection)
			const surfEntry = makeStoreEntry('surf-mod', ['SurfProduct'], ModuleInstanceType.Surface)
			const store = makeModules(
				new Map(),
				new Map([
					['connection:conn-mod', connEntry],
					['surface:surf-mod', surfEntry],
				])
			)
			const { result } = renderHookWithStore(store, () => useAllModuleProducts(ModuleInstanceType.Surface))

			expect(result.current).toHaveLength(1)
			expect(result.current[0].moduleType).toBe(ModuleInstanceType.Surface)
		})
	})
})

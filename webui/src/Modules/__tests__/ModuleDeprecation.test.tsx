import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleUpgradeToOtherVersion } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ModuleDeprecationAlert } from '../ModuleDeprecationAlert.js'
import { useModuleDeprecationInfo } from '../useModuleDeprecationInfo.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStoreEntry(deprecationReason: string | null): ModuleStoreListCacheEntry {
	return {
		id: 'bmd-atem',
		name: 'Blackmagic ATEM',
		shortname: 'atem',
		products: ['ATEM Mini'],
		keywords: [],
		storeUrl: 'https://store.example.com',
		githubUrl: null,
		helpUrl: null,
		legacyIds: [],
		deprecationReason,
	}
}

function makeUpgradeTo(displayName: string): ModuleUpgradeToOtherVersion {
	return { moduleId: displayName.toLowerCase(), displayName, helpPath: null, versionId: null }
}

// Only the few things the notice reaches for - the store list entry, and the replacements the store
// offers for the module
function makeStore(
	storeEntry: ModuleStoreListCacheEntry | undefined,
	upgradeToVersions: ModuleUpgradeToOtherVersion[]
): RootAppStore {
	return {
		modules: {
			getStoreInfo: () => storeEntry,
			storeVersions: {
				subscribeToModuleUpgradeToVersions: () => () => undefined,
				getModuleUpgradeToVersions: () => upgradeToVersions,
			},
		},
	} as unknown as RootAppStore
}

function renderDeprecationInfo(store: RootAppStore, moduleId: string | undefined) {
	const moduleType = moduleId ? ModuleInstanceType.Connection : undefined
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<RootAppStoreContext.Provider value={store}>{children}</RootAppStoreContext.Provider>
	)
	return renderHook(() => useModuleDeprecationInfo(moduleType, moduleId), { wrapper })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useModuleDeprecationInfo', () => {
	it('reports nothing for a module the store does not know', () => {
		const { result } = renderDeprecationInfo(makeStore(undefined, []), 'bmd-atem')
		expect(result.current).toBeNull()
	})

	it('reports nothing for a module which is not deprecated', () => {
		const { result } = renderDeprecationInfo(makeStore(makeStoreEntry(null), []), 'bmd-atem')
		expect(result.current).toBeNull()
	})

	it('reports nothing when no module is being shown', () => {
		const { result } = renderDeprecationInfo(makeStore(makeStoreEntry('Gone away'), []), undefined)
		expect(result.current).toBeNull()
	})

	it('reports the reason the store gave', () => {
		const { result } = renderDeprecationInfo(makeStore(makeStoreEntry('The hardware is end of life'), []), 'bmd-atem')
		expect(result.current).toEqual({ reason: 'The hardware is end of life', replacementNames: [] })
	})

	it('reports the replacements the store offers', () => {
		const store = makeStore(makeStoreEntry('Replaced'), [makeUpgradeTo('ATEM Next'), makeUpgradeTo('ATEM Other')])
		const { result } = renderDeprecationInfo(store, 'bmd-atem')
		expect(result.current?.replacementNames).toEqual(['ATEM Next', 'ATEM Other'])
	})
})

describe('ModuleDeprecationAlert', () => {
	it('explains what deprecation means, alongside the reason', () => {
		render(<ModuleDeprecationAlert info={{ reason: 'The hardware is end of life', replacementNames: [] }} />)

		expect(screen.getByText('This module is deprecated')).toBeInTheDocument()
		expect(screen.getByText('The hardware is end of life')).toBeInTheDocument()
		expect(screen.getByText(/no longer maintained/)).toBeInTheDocument()
	})

	it('explains what deprecation means when the store gave no reason', () => {
		render(<ModuleDeprecationAlert info={{ reason: null, replacementNames: [] }} />)

		expect(screen.getByText('This module is deprecated')).toBeInTheDocument()
		expect(screen.getByText(/no longer maintained/)).toBeInTheDocument()
	})

	it('names a single replacement', () => {
		render(<ModuleDeprecationAlert info={{ reason: null, replacementNames: ['ATEM Next'] }} />)

		expect(screen.getByText(/ATEM Next is offered as a replacement/)).toBeInTheDocument()
	})

	it('lists several replacements', () => {
		render(<ModuleDeprecationAlert info={{ reason: null, replacementNames: ['ATEM Next', 'ATEM Other'] }} />)

		expect(screen.getByText(/replacement: ATEM Next, ATEM Other/)).toBeInTheDocument()
	})
})

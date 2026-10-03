import { render, screen, within } from '@testing-library/react'
import { observer } from 'mobx-react-lite'
import { describe, expect, it, vi } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type {
	ModuleStoreListCacheEntry,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import {
	describeModuleDeprecation,
	ModuleDeprecationAlert,
	ModuleDeprecationBadge,
	moduleDeprecationLabel,
	useModuleDeprecation,
} from '../ModuleDeprecation.js'

// The store subscribes for a module's versions over trpc; serve whatever the test seeded for it
const storeVersions = vi.hoisted(() => new Map<string, { versions: unknown[] }>())

vi.mock('~/Resources/TRPC', () => ({
	trpc: {
		instances: {
			modulesStore: {
				watchModuleInfo: {
					subscriptionOptions: (input: { moduleType: string; moduleId: string }) => ({
						subscribe: (handlers: { onData: (data: unknown) => void }) => {
							handlers.onData(storeVersions.get(`${input.moduleType}:${input.moduleId}`) ?? null)
							return { unsubscribe: () => undefined }
						},
					}),
				},
			},
		},
	},
}))

const MODULE_TYPE = ModuleInstanceType.Connection
const MODULE_ID = 'my-module'

function makeStoreEntry(overrides: Partial<ModuleStoreListCacheEntry>): ModuleStoreListCacheEntry {
	return {
		id: MODULE_ID,
		name: 'My Module',
		shortname: 'mine',
		products: ['Thing'],
		keywords: [],
		storeUrl: 'https://store.example.com',
		githubUrl: null,
		helpUrl: null,
		legacyIds: [],
		deprecationReason: null,
		...overrides,
	}
}

function makeStoreVersion(id: string, deprecationReason: string | null): ModuleStoreModuleInfoVersion {
	return {
		id,
		releaseChannel: 'stable',
		releasedAt: 0,
		tarUrl: null,
		tarSha: null,
		deprecationReason,
		apiVersion: '1.0.0',
		helpUrl: null,
	}
}

interface SeedOptions {
	/** Deprecation reason for the module as a whole, or `null` for a current module */
	moduleReason?: string | null
	/** Store versions of the module, keyed by version id, each with its own deprecation reason */
	versionReasons?: Record<string, string | null>
}

function makeStore({ moduleReason = null, versionReasons = {} }: SeedOptions): ModuleInfoStore {
	const modules = new ModuleInfoStore()

	modules.updateStoreInfo({
		lastUpdated: 0,
		lastUpdateAttempt: 0,
		updateWarning: null,
		connectionModuleApiVersion: '1.0.0',
		connectionModules: { [MODULE_ID]: makeStoreEntry({ deprecationReason: moduleReason }) },
		surfaceModuleApiVersion: null,
		surfaceModules: null,
	})

	storeVersions.clear()
	storeVersions.set(`${MODULE_TYPE}:${MODULE_ID}`, {
		versions: Object.entries(versionReasons).map(([id, reason]) => makeStoreVersion(id, reason)),
	})

	return modules
}

/** The realistic composition: an observer looking the deprecation up, then rendering both displays */
const Probe = observer(function Probe({ versionId }: { versionId: string | null }) {
	const deprecation = useModuleDeprecation(MODULE_TYPE, MODULE_ID, versionId)
	if (!deprecation) return <span>not deprecated</span>

	// Both displays carry the label, so keep them apart for the assertions
	return (
		<>
			<div data-testid="badge">
				<ModuleDeprecationBadge deprecation={deprecation} />
			</div>
			<div data-testid="alert">
				<ModuleDeprecationAlert deprecation={deprecation} />
			</div>
		</>
	)
})

/** The badge's label - the compact summary a list row shows */
function badgeLabel(): string {
	return within(screen.getByTestId('badge')).getByText(/Deprecated/).textContent ?? ''
}

function renderProbe(options: SeedOptions, versionId: string | null) {
	const store = { modules: makeStore(options) } as unknown as RootAppStore
	return render(
		<RootAppStoreContext.Provider value={store}>
			<Probe versionId={versionId} />
		</RootAppStoreContext.Provider>
	)
}

describe('useModuleDeprecation', () => {
	it('reports nothing when neither the module nor the version in use is deprecated', () => {
		renderProbe({ versionReasons: { '1.0.0': null } }, '1.0.0')

		expect(screen.getByText('not deprecated')).toBeInTheDocument()
	})

	it('reports a module that has been deprecated as a whole', () => {
		renderProbe({ moduleReason: 'Superseded by generic-tcp' }, '1.0.0')

		expect(badgeLabel()).toBe('Deprecated')
		expect(screen.getByText('This module is deprecated: Superseded by generic-tcp')).toBeInTheDocument()
	})

	it('reports a deprecated version of a module that is otherwise current', () => {
		renderProbe({ versionReasons: { '1.0.0': 'Broken protocol handling' } }, '1.0.0')

		// Only the version is at fault, so the label must not condemn the whole module
		expect(badgeLabel()).toBe('Deprecated version')
		expect(screen.getByText('The version in use is deprecated: Broken protocol handling')).toBeInTheDocument()
	})

	it('ignores a deprecated version that is not the one in use', () => {
		renderProbe({ versionReasons: { '1.0.0': 'Broken protocol handling', '2.0.0': null } }, '2.0.0')

		expect(screen.getByText('not deprecated')).toBeInTheDocument()
	})

	it('ignores versions for a dev build, which the store does not publish', () => {
		renderProbe({ versionReasons: { dev: 'Should never be consulted' } }, 'dev')

		expect(screen.getByText('not deprecated')).toBeInTheDocument()
	})

	it('still reports a deprecated module when a dev build of it is in use', () => {
		renderProbe({ moduleReason: 'No longer maintained' }, 'dev')

		expect(screen.getByText('This module is deprecated: No longer maintained')).toBeInTheDocument()
	})

	it('reports only the module level when no particular version is in context', () => {
		renderProbe({ moduleReason: 'No longer maintained', versionReasons: { '1.0.0': 'Broken' } }, null)

		expect(screen.getByText('This module is deprecated: No longer maintained')).toBeInTheDocument()
		expect(screen.queryByText(/The version in use is deprecated/)).not.toBeInTheDocument()
	})

	it('reports both levels when the module and the version in use are each deprecated', () => {
		renderProbe({ moduleReason: 'No longer maintained', versionReasons: { '1.0.0': 'Broken' } }, '1.0.0')

		expect(screen.getByText('This module is deprecated: No longer maintained')).toBeInTheDocument()
		expect(screen.getByText('The version in use is deprecated: Broken')).toBeInTheDocument()
	})
})

describe('describeModuleDeprecation', () => {
	it('quotes the reason the store gave', () => {
		expect(describeModuleDeprecation({ module: 'Superseded', version: null })).toEqual([
			'This module is deprecated: Superseded',
		])
	})

	it('falls back to advice when the store deprecated the module without a reason', () => {
		expect(describeModuleDeprecation({ module: '', version: null })).toEqual([
			'This module is deprecated, and will receive no further updates. You should look for an alternative.',
		])
	})

	it('falls back to advice when the store deprecated the version without a reason', () => {
		expect(describeModuleDeprecation({ module: null, version: '  ' })).toEqual([
			'The version in use is deprecated, and should be changed to a supported one.',
		])
	})

	it('describes the module before the version when both are deprecated', () => {
		expect(describeModuleDeprecation({ module: 'Gone', version: 'Buggy' })).toEqual([
			'This module is deprecated: Gone',
			'The version in use is deprecated: Buggy',
		])
	})
})

describe('moduleDeprecationLabel', () => {
	it('names the whole module when it is the module that is deprecated', () => {
		expect(moduleDeprecationLabel({ module: 'Gone', version: null })).toBe('Deprecated')
		expect(moduleDeprecationLabel({ module: 'Gone', version: 'Buggy' })).toBe('Deprecated')
	})

	it('names only the version when the module itself is current', () => {
		expect(moduleDeprecationLabel({ module: null, version: 'Buggy' })).toBe('Deprecated version')
	})
})

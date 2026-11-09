import { act, render, screen } from '@testing-library/react'
import { observable, runInAction } from 'mobx'
import { describe, expect, it, vi } from 'vitest'
import type { ClientConnectionConfig, ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ConnectionCollectionUpdates } from '../ConnectionCollectionUpdates.js'

function connection(
	id: string,
	collectionId: string | null,
	overrides: Partial<ClientConnectionConfig> = {}
): ClientConnectionConfig {
	return {
		id,
		collectionId,
		label: id,
		moduleType: ModuleInstanceType.Connection,
		moduleId: 'test',
		moduleVersionId: '1.0.0',
		updatePolicy: InstanceVersionUpdatePolicy.Stable,
		enabled: true,
		sortOrder: 0,
		hasRecordActionsHandler: false,
		...overrides,
	}
}

const child: ConnectionCollection = {
	id: 'child',
	label: 'Child',
	sortOrder: 0,
	metaData: { enabled: true },
	children: [],
}
const parent: ConnectionCollection = { ...child, id: 'parent', children: [child] }
function version(id: string, releaseChannel: 'stable' | 'beta' = 'stable'): ModuleStoreModuleInfoVersion {
	return {
		id,
		releaseChannel,
		apiVersion: '1.0.0',
		releasedAt: 0,
		tarUrl: null,
		tarSha: null,
		helpUrl: null,
		deprecationReason: null,
	}
}

function setup(instances: ClientConnectionConfig[], versions: ModuleStoreModuleInfoVersion[] = []) {
	const connections = observable.map(instances.map((instance) => [instance.id, instance]))
	const info = observable({ versions, replacement: false })
	const unsubscribe = vi.fn()
	const subscribe = vi.fn(() => unsubscribe)
	const store = {
		connections: { connections },
		modules: {
			storeVersions: {
				subscribeToModuleStoreVersions: subscribe,
				subscribeToModuleUpgradeToVersions: subscribe,
				getModuleStoreVersions: () => info,
				getModuleUpgradeToVersions: () => (info.replacement ? [{}] : []),
			},
		},
	} as unknown as RootAppStore
	const view = render(
		<RootAppStoreContext.Provider value={store}>
			<ConnectionCollectionUpdates collection={parent} />
		</RootAppStoreContext.Provider>
	)
	return { connections, info, subscribe, unsubscribe, ...view }
}

describe('collection update badge', () => {
	it('counts direct and nested connections, including disabled ones, without counting other collections or pinned versions', () => {
		const { subscribe, unsubscribe, unmount } = setup(
			[
				connection('direct', 'parent'),
				connection('nested', 'child', { enabled: false }),
				connection('elsewhere', 'other'),
				connection('ungrouped', null),
				connection('manual', 'child', { updatePolicy: InstanceVersionUpdatePolicy.Manual }),
				connection('dev', 'child', { moduleVersionId: 'dev' }),
			],
			[version('1.1.0')]
		)
		expect(screen.getByText('2 updates')).toBeInTheDocument()
		// One pair of subscriptions per module, even when multiple connections use it.
		expect(subscribe).toHaveBeenCalledTimes(2)
		unmount()
		expect(unsubscribe).toHaveBeenCalledTimes(2)
	})

	it('reacts to incoming versions and updated connections without mounted connection rows', () => {
		const { info, connections } = setup([connection('nested', 'child')])
		expect(screen.queryByText(/update/)).not.toBeInTheDocument()
		act(() =>
			runInAction(() => {
				info.versions.push(version('1.1.0'))
			})
		)
		expect(screen.getByText('1 update')).toBeInTheDocument()
		act(() =>
			runInAction(() => {
				connections.get('nested')!.moduleVersionId = '1.1.0'
			})
		)
		expect(screen.queryByText(/update/)).not.toBeInTheDocument()
	})

	it('respects beta policy and excludes incompatible and deprecated releases', () => {
		setup(
			[connection('stable', 'parent'), connection('beta', 'child', { updatePolicy: InstanceVersionUpdatePolicy.Beta })],
			[
				version('1.1.0-beta.1', 'beta'),
				{ ...version('2.0.0'), apiVersion: '99.0.0' },
				{ ...version('1.2.0'), deprecationReason: 'Obsolete' },
			]
		)
		expect(screen.getByText('1 update')).toBeInTheDocument()
	})

	it('includes module replacements', () => {
		const { info } = setup([connection('nested', 'child')])
		act(() =>
			runInAction(() => {
				info.replacement = true
			})
		)
		expect(screen.getByText('1 update')).toBeInTheDocument()
	})
})

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreModuleInfoStore } from '@companion-app/shared/Model/ModulesStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ModuleVersionsTable } from '../ModuleVersionsTable.js'

vi.mock('../RefreshModuleInfo.js', () => ({ RefreshModuleInfo: () => null }))
vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		instances: {
			modulesManager: {
				uninstallModule: { mutationOptions: () => ({}) },
				installStoreModule: { mutationOptions: () => ({}) },
			},
		},
	},
	useMutationExt: () => ({ mutateAsync: vi.fn() }),
}))

const version = {
	versionId: '1.0.0',
	displayName: '1.0.0',
	helpPath: '/help',
	isBeta: false,
	isLegacy: false,
	allowMultipleInstances: true,
}
const storeInfo: ModuleStoreModuleInfoStore = {
	id: 'example',
	moduleType: ModuleInstanceType.Surface,
	lastUpdated: 0,
	lastUpdateAttempt: 0,
	updateWarning: null,
	versions: [
		{
			id: '1.0.0',
			releaseChannel: 'beta',
			deprecationReason: 'Replaced by version 2',
			apiVersion: '1.0.0',
			releasedAt: 0,
			tarUrl: '/module',
			tarSha: null,
			helpUrl: '/help',
		},
	],
}

function renderTable(moduleType: ModuleInstanceType, inUse: boolean, builtin = false) {
	const installed = {
		moduleType,
		installedVersions: builtin ? [] : [version],
		builtinVersion: builtin ? { ...version, versionId: 'builtin', displayName: 'Builtin' } : null,
		devVersion: null,
	} as ClientModuleInfo
	const instance = {
		moduleType: ModuleInstanceType.Surface,
		moduleId: 'example',
		moduleVersionId: builtin ? 'builtin' : '1.0.0',
	}
	const root = {
		modules: { getModuleInfo: () => installed },
		connections: { connections: new Map() },
		surfaceInstances: { instances: new Map(inUse ? [['surface-1', instance]] : []) },
		helpViewer: { current: null },
		notifier: {},
	} as unknown as RootAppStore
	render(
		<RootAppStoreContext.Provider value={root}>
			<ModuleVersionsTable moduleType={moduleType} moduleId="example" moduleStoreInfo={builtin ? null : storeInfo} />
		</RootAppStoreContext.Provider>
	)
}

beforeEach(() => {
	const storage = new Map<string, string>()
	Object.defineProperty(window, 'localStorage', {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		},
	})
})

describe('ModuleVersionsTable', () => {
	it('keeps installed beta and deprecated versions visible and protects surface versions in use', () => {
		renderTable(ModuleInstanceType.Surface, true)
		const row = screen.getByText('1.0.0').closest('tr')!
		expect(within(row).getByText('Installed')).toBeInTheDocument()
		expect(within(row).getByText('Deprecated')).toHaveAttribute('title', 'Replaced by version 2')
		expect(within(row).getByText('In use · 1')).toBeInTheDocument()
		expect(within(row).getAllByRole('button')[0]).toBeDisabled()
	})

	it('does not count a surface instance as usage of a connection module with the same ID', () => {
		renderTable(ModuleInstanceType.Connection, true)
		expect(screen.getByText('Not in use')).toBeInTheDocument()
		expect(screen.getAllByRole('button').find((button) => button.querySelector('[data-icon="trash"]'))).toBeEnabled()
	})

	it('shows built-in usage without offering an uninstall action', () => {
		renderTable(ModuleInstanceType.Surface, true, true)
		expect(screen.getByText('Built-in')).toBeInTheDocument()
		expect(screen.getByText('In use · 1')).toBeInTheDocument()
		expect(document.querySelector('[data-icon="trash"]')).toBeNull()
	})
})

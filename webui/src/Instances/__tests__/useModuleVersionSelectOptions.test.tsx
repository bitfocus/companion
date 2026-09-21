import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { useModuleVersionSelectOptions } from '~/Instances/useModuleVersionSelectOptions'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore'

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

function renderOptions(storeVersions: ModuleStoreModuleInfoVersion[], installedVersionIds: string[]) {
	const mockStore = {
		modules: {
			storeVersions: {
				subscribeToModuleStoreVersions: () => () => {},
				getModuleStoreVersions: () => ({ versions: storeVersions }),
				subscribeToModuleUpgradeToVersions: () => () => {},
				getModuleUpgradeToVersions: () => [],
			},
		},
	} as unknown as RootAppStore

	const installedInfo = {
		installedVersions: installedVersionIds.map((versionId) => ({
			versionId,
			displayName: `v${versionId}`,
			isLegacy: false,
			isBeta: false,
			helpPath: '',
			allowMultipleInstances: false,
		})),
		stableVersion: null,
		betaVersion: null,
		devVersion: null,
		builtinVersion: null,
	} as unknown as ClientModuleInfo

	return renderHook(
		() => useModuleVersionSelectOptions(ModuleInstanceType.Connection, 'some-module', installedInfo, false),
		{
			wrapper: ({ children }) => (
				<RootAppStoreContext.Provider value={mockStore}>{children}</RootAppStoreContext.Provider>
			),
		}
	)
}

describe('useModuleVersionSelectOptions', () => {
	it('marks an installed version which the store has deprecated', () => {
		const { result } = renderOptions(
			[makeStoreVersion('1.1.0', 'Sends the wrong command.'), makeStoreVersion('1.2.0', null)],
			['1.1.0', '1.2.0']
		)

		const labels = result.current.choices.map((choice) => choice.label)
		expect(labels).toContain('v1.1.0 (Deprecated)')
	})

	it('leaves a version which is not deprecated alone', () => {
		const { result } = renderOptions([makeStoreVersion('1.2.0', null)], ['1.2.0'])

		const labels = result.current.choices.map((choice) => choice.label)
		expect(labels).toContain('v1.2.0 (Latest stable)')
		expect(labels.join()).not.toContain('Deprecated')
	})
})

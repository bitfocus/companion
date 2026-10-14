import { describe, expect, test, vi } from 'vitest'
import { ModuleInstanceType } from '../../../shared-lib/lib/Model/Instance.js'
import type { InstanceConfigStore } from '../../lib/Instance/ConfigStore.js'
import { InstanceInstalledModulesManager } from '../../lib/Instance/InstalledModulesManager.js'
import type { InstanceModules } from '../../lib/Instance/Modules.js'
import type { ModuleStoreService } from '../../lib/Instance/ModuleStore.js'
import type { AppInfo } from '../../lib/Registry.js'

function createManager(installed: boolean) {
	const modulesManager = { getModuleManifest: vi.fn(() => (installed ? {} : undefined)) }
	const modulesStore = { fetchModuleVersionInfo: vi.fn(async () => null) }

	const manager = new InstanceInstalledModulesManager(
		{ options: { enableRestrictedModules: false } } as unknown as AppInfo,
		modulesManager as unknown as InstanceModules,
		modulesStore as unknown as ModuleStoreService,
		{} as InstanceConfigStore
	)

	return { manager, modulesStore }
}

describe('ensureModuleIsInstalled', () => {
	test.each(['dev', 'builtin'])('does not look for a %s version in the store', (versionId) => {
		const { manager, modulesStore } = createManager(false)

		manager.ensureModuleIsInstalled(ModuleInstanceType.Connection, 'my-module', versionId)

		expect(modulesStore.fetchModuleVersionInfo).not.toHaveBeenCalled()
	})

	test.each([null, '1.2.3'])('fetches a missing %s version from the store', (versionId) => {
		const { manager, modulesStore } = createManager(false)

		manager.ensureModuleIsInstalled(ModuleInstanceType.Connection, 'my-module', versionId)

		expect(modulesStore.fetchModuleVersionInfo).toHaveBeenCalledWith(
			ModuleInstanceType.Connection,
			'my-module',
			versionId,
			true
		)
	})

	test('does nothing when the version is already installed', () => {
		const { manager, modulesStore } = createManager(true)

		manager.ensureModuleIsInstalled(ModuleInstanceType.Connection, 'my-module', '1.2.3')

		expect(modulesStore.fetchModuleVersionInfo).not.toHaveBeenCalled()
	})
})

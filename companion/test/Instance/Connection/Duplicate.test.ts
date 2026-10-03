import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '@companion-app/shared/Model/Instance.js'
import type { IControlStore } from '../../../lib/Controls/IControlStore.js'
import { DataCache } from '../../../lib/Data/Cache.js'
import { DataDatabase } from '../../../lib/Data/Database.js'
import type { MetricsRegistry } from '../../../lib/Data/Metrics.js'
import { InstanceController } from '../../../lib/Instance/Controller.js'
import type { AppInfo } from '../../../lib/Registry.js'
import type { ServiceOscSender } from '../../../lib/Service/OscSender.js'
import type { SurfaceController } from '../../../lib/Surface/Controller.js'
import type { VariablesController } from '../../../lib/Variables/Controller.js'

const SOURCE_ID = 'source-connection'
const COLLECTION_ID = 'camera-collection'

function createConnection(overrides: Partial<InstanceConfig> = {}): InstanceConfig {
	return {
		moduleInstanceType: ModuleInstanceType.Connection,
		moduleId: 'test-camera',
		moduleVersionId: '1.2.3',
		label: 'camera',
		config: { host: '192.0.2.10', nested: { port: 1234 } },
		secrets: { password: 'secret' },
		isFirstInit: false,
		lastUpgradeIndex: 7,
		enabled: true,
		sortOrder: 20,
		updatePolicy: InstanceVersionUpdatePolicy.Beta,
		collectionId: COLLECTION_ID,
		...overrides,
	}
}

describe('InstanceController duplicateConnection', () => {
	let db: DataDatabase
	let cache: DataCache
	let controlsStore: ReturnType<typeof mockDeep<IControlStore>>
	let controller: InstanceController

	beforeEach(() => {
		vi.useFakeTimers()

		db = new DataDatabase(':memory:')
		cache = new DataCache(':memory:')
		controlsStore = mockDeep<IControlStore>()

		const instances = db.getTableView<Record<string, InstanceConfig>>('instances')
		instances.set('before', createConnection({ label: 'before', sortOrder: 10 }))
		instances.set(SOURCE_ID, createConnection())
		instances.set('after', createConnection({ label: 'after', sortOrder: 40 }))
		instances.set('ungrouped', createConnection({ label: 'ungrouped', collectionId: undefined, sortOrder: 50 }))
		instances.set(
			'disabled-source',
			createConnection({ label: 'disabled', collectionId: undefined, enabled: false, sortOrder: 60 })
		)
		instances.set(
			'legacy-enabled-source',
			createConnection({ label: 'legacy-enabled', collectionId: undefined, enabled: undefined, sortOrder: 70 })
		)

		const appInfo = {
			configDir: ':memory:',
			logsDir: undefined,
			modulesDirs: {
				[ModuleInstanceType.Connection]: '',
				[ModuleInstanceType.Surface]: '',
			},
			builtinModuleDirs: {
				[ModuleInstanceType.Connection]: null,
				[ModuleInstanceType.Surface]: null,
			},
			udevRulesDir: '',
			machineId: 'test-machine',
			appVersion: 'test',
			appBuild: 'test',
			pkgInfo: {},
			options: {
				notifications: false,
				enableShellCommandSupport: false,
				enableRestrictedModules: false,
				trustedProxies: undefined,
				installNameOverride: undefined,
			},
		} as AppInfo

		controller = new InstanceController(
			appInfo,
			db,
			cache,
			express.Router(),
			controlsStore,
			mockDeep<VariablesController>(),
			mockDeep<SurfaceController>(),
			mockDeep<ServiceOscSender>(),
			mockDeep<MetricsRegistry>()
		)
		vi.spyOn(controller.userModulesManager, 'ensureModuleIsInstalled').mockImplementation(() => undefined)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
		cache.close()
		db.close()
	})

	it('copies the connection configuration and inserts it immediately after the source', () => {
		const newId = controller.duplicateConnection(SOURCE_ID)
		expect(newId).toBeTypeOf('string')
		expect(newId).not.toBe(SOURCE_ID)
		expect(controller.userModulesManager.ensureModuleIsInstalled).toHaveBeenCalledWith(
			ModuleInstanceType.Connection,
			'test-camera',
			'1.2.3'
		)

		const instances = db.getTableView<Record<string, InstanceConfig>>('instances').all()
		const source = instances[SOURCE_ID]
		const duplicate = instances[newId!]

		expect(duplicate).toMatchObject({
			moduleInstanceType: ModuleInstanceType.Connection,
			moduleId: source.moduleId,
			moduleVersionId: source.moduleVersionId,
			label: 'camera_2',
			config: source.config,
			secrets: source.secrets,
			isFirstInit: false,
			lastUpgradeIndex: source.lastUpgradeIndex,
			enabled: source.enabled,
			updatePolicy: source.updatePolicy,
			collectionId: source.collectionId,
		})

		const collectionOrder = Object.entries(instances)
			.filter(([, config]) => config.collectionId === COLLECTION_ID)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([id]) => id)
		expect(collectionOrder).toEqual(['before', SOURCE_ID, newId, 'after'])
		expect(instances.ungrouped.sortOrder).toBe(50)
	})

	it('does not copy or rewrite controls that reference the source connection', () => {
		controller.duplicateConnection(SOURCE_ID)

		expect(controlsStore.renameVariables).not.toHaveBeenCalled()
		expect(controlsStore.forgetConnection).not.toHaveBeenCalled()
		expect(controlsStore.clearConnectionState).not.toHaveBeenCalled()
		expect(controlsStore.updateFeedbackValues).not.toHaveBeenCalled()
	})

	it('keeps a disabled source disabled', () => {
		const instances = db.getTableView<Record<string, InstanceConfig>>('instances')
		const newId = controller.duplicateConnection('disabled-source')
		const duplicate = instances.get(newId!)
		expect(duplicate?.enabled).toBe(false)
	})

	it('keeps a legacy source without an enabled field enabled', () => {
		const instances = db.getTableView<Record<string, InstanceConfig>>('instances')
		const newId = controller.duplicateConnection('legacy-enabled-source')
		const duplicate = instances.get(newId!)
		expect(duplicate?.enabled).toBe(true)
	})

	it('duplicates an ungrouped connection immediately after its source', () => {
		const newId = controller.duplicateConnection('ungrouped')
		const instances = db.getTableView<Record<string, InstanceConfig>>('instances').all()
		const ungroupedOrder = Object.entries(instances)
			.filter(([, config]) => !config.collectionId)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([id]) => id)

		expect(ungroupedOrder).toEqual(['ungrouped', newId, 'disabled-source', 'legacy-enabled-source'])
	})

	it('uses stable labels and ordering when the same connection is duplicated repeatedly', () => {
		const firstId = controller.duplicateConnection(SOURCE_ID)
		const secondId = controller.duplicateConnection(SOURCE_ID)
		const instances = db.getTableView<Record<string, InstanceConfig>>('instances').all()

		expect(instances[firstId!].label).toBe('camera_2')
		expect(instances[secondId!].label).toBe('camera_3')

		const collectionOrder = Object.entries(instances)
			.filter(([, config]) => config.collectionId === COLLECTION_ID)
			.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
			.map(([id]) => id)
		expect(collectionOrder).toEqual(['before', SOURCE_ID, secondId, firstId, 'after'])
	})

	it('returns undefined when the source connection does not exist', () => {
		expect(controller.duplicateConnection('missing')).toBeUndefined()
		expect(controller.userModulesManager.ensureModuleIsInstalled).not.toHaveBeenCalled()
	})
})

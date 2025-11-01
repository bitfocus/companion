/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { InstanceDefinitions } from './Definitions.js'
import { InstanceProcessManager } from './ProcessManager.js'
import { InstanceStatus } from './Status.js'
import { isLabelValid, makeLabelSafe } from '@companion-app/shared/Label.js'
import { InstanceModules } from './Modules.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { ClientConnectionConfig, ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import {
	ModuleInstanceType,
	type InstanceConfig,
	type InstanceVersionUpdatePolicy,
} from '@companion-app/shared/Model/Instance.js'
import type { ModuleManifest } from '@companion-module/base'
import type { ExportInstanceFullv6, ExportInstanceMinimalv6 } from '@companion-app/shared/Model/ExportModel.js'
import { InstanceConfigStore, type AddInstanceProps } from './ConfigStore.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import { InstanceSharedUdpManager } from './Connection/SharedUdpManager.js'
import type { ServiceOscSender } from '../Service/OscSender.js'
import type { DataDatabase } from '../Data/Database.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import express from 'express'
import { InstanceInstalledModulesManager } from './InstalledModulesManager.js'
import { ModuleStoreService } from './ModuleStore.js'
import type { AppInfo } from '../Registry.js'
import type { DataCache } from '../Data/Cache.js'
import { ConnectionsCollections } from './Connection/Collections.js'
import type { Complete } from '@companion-module/base/dist/util.js'
import { createConnectionsTrpcRouter } from './Connection/TrpcRouter.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { createSurfacesTrpcRouter } from './Surface/TrpcRouter.js'
import type {
	ClientSurfaceInstanceConfig,
	ClientSurfaceInstancesUpdate,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import { SurfaceInstanceCollections } from './Surface/Collections.js'
import type { SurfaceController } from '../Surface/Controller.js'

type CreateConnectionData = {
	type: string
	product?: string
}

export interface InstanceControllerEvents {
	connection_added: [connectionId?: string]
	connection_updated: [connectionId: string]
	connection_deleted: [connectionId: string]
	connection_collections_enabled: []

	surface_instance_added: [instanceId?: string]
	surface_instance_updated: [instanceId: string]
	surface_instance_deleted: [instanceId: string]
	surface_collections_enabled: []

	uiConnectionsUpdate: [changes: ClientConnectionsUpdate[]]
	uiSurfaceInstancesUpdate: [changes: ClientSurfaceInstancesUpdate[]]
	[id: `debugLog:${string}`]: [time: number | null, source: string, level: string, message: string]
}

export class InstanceController extends EventEmitter<InstanceControllerEvents> {
	readonly #logger = LogController.createLogger('Instance/Controller')

	readonly #controlsController: ControlsController
	readonly #variablesController: VariablesController
	readonly #surfacesController: SurfaceController
	readonly #connectionCollectionsController: ConnectionsCollections
	readonly #surfaceInstanceCollectionsController: SurfaceInstanceCollections

	readonly #configStore: InstanceConfigStore

	#lastClientJson: Record<string, ClientConnectionConfig> | null = null

	readonly definitions: InstanceDefinitions
	readonly status: InstanceStatus
	readonly processManager: InstanceProcessManager
	readonly modules: InstanceModules
	readonly sharedUdpManager: InstanceSharedUdpManager
	readonly modulesStore: ModuleStoreService
	readonly userModulesManager: InstanceInstalledModulesManager

	readonly connectionApiRouter = express.Router()

	get connectionCollections(): ConnectionsCollections {
		return this.#connectionCollectionsController
	}
	get surfaceInstanceCollections(): SurfaceInstanceCollections {
		return this.#surfaceInstanceCollectionsController
	}

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		cache: DataCache,
		apiRouter: express.Router,
		controls: ControlsController,
		graphics: GraphicsController,
		variables: VariablesController,
		surfaces: SurfaceController,
		oscSender: ServiceOscSender
	) {
		super()
		this.setMaxListeners(0)

		this.#variablesController = variables
		this.#surfacesController = surfaces
		this.#controlsController = controls

		this.#configStore = new InstanceConfigStore(db, (instanceIds, updateProcessManager) => {
			// Ensure any changes to collectionId update the enabled state
			if (updateProcessManager) {
				for (const instanceId of instanceIds) {
					try {
						this.#queueUpdateInstanceState(instanceId, true, false)
					} catch (e) {
						this.#logger.warn(`Error updating instance state for ${instanceId}: `, e)
					}
				}
			}

			this.#broadcastConnectionChanges(instanceIds)
			this.#broadcastSurfaceInstanceChanges(instanceIds)
		})
		this.#connectionCollectionsController = new ConnectionsCollections(db, this.#configStore, () => {
			this.emit('connection_collections_enabled')

			this.#queueUpdateAllConnectionState(ModuleInstanceType.Connection)
		})
		this.#surfaceInstanceCollectionsController = new SurfaceInstanceCollections(db, this.#configStore, () => {
			this.emit('surface_collections_enabled')

			this.#queueUpdateAllConnectionState(ModuleInstanceType.Surface)
		})

		this.sharedUdpManager = new InstanceSharedUdpManager()
		this.definitions = new InstanceDefinitions(this.#configStore)
		this.status = new InstanceStatus()
		this.modules = new InstanceModules(this, apiRouter, appInfo.modulesDirs)
		this.processManager = new InstanceProcessManager(
			{
				controls: controls,
				variables: variables,
				oscSender: oscSender,

				instanceDefinitions: this.definitions,
				instanceStatus: this.status,
				sharedUdpManager: this.sharedUdpManager,
				setConnectionConfig: (instanceId, config, secrets, upgradeIndex) => {
					this.setConnectionLabelAndConfig(
						instanceId,
						{
							label: null,
							enabled: null,
							config,
							secrets,
							updatePolicy: null,
							upgradeIndex,
						},
						{
							skipNotifyConnection: true,
						}
					)
				},
				debugLogLine: (connectionId: string, time: number | null, source: string, level: string, message: string) => {
					this.emit(`debugLog:${connectionId}`, time, source, level, message)
				},
			},
			{
				surfaceController: surfaces,
				instanceStatus: this.status,
				debugLogLine: (instanceId: string, time: number | null, source: string, level: string, message: string) => {
					this.emit(`debugLog:${instanceId}`, time, source, level, message)
				},
				invalidateClientJson: (instanceId: string) => {
					this.#broadcastSurfaceInstanceChanges([instanceId])
				},
			},
			this.modules,
			this.#configStore
		)
		this.modulesStore = new ModuleStoreService(appInfo, cache)
		this.userModulesManager = new InstanceInstalledModulesManager(
			appInfo,
			this.modules,
			this.modulesStore,
			this.#configStore
		)
		this.modules.listenToStoreEvents(this.modulesStore)

		graphics.on('resubscribeFeedbacks', () => this.processManager.resubscribeAllFeedbacks())

		this.connectionApiRouter.use('/:label', (req, res, _next) => {
			const label = req.params.label
			const connectionId = this.getIdForLabel(ModuleInstanceType.Connection, label) || label
			const connection = this.processManager.getConnectionChild(connectionId)
			if (connection) {
				connection.executeHttpRequest(req, res)
			} else {
				res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
			}
		})

		// Prepare for clients already
		this.#broadcastConnectionChanges(this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection))
		this.#broadcastSurfaceInstanceChanges(this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Surface))
	}

	getAllConnectionIds(): string[] {
		return this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)
	}

	/**
	 * Handle an electron power event
	 */
	powerStatusChange(event: string): void {
		if (event == 'resume') {
			this.#logger.info('Power: Resuming')

			for (const id of this.#configStore.getAllInstanceIdsOfType(null)) {
				this.#queueUpdateInstanceState(id)
			}
		} else if (event == 'suspend') {
			this.#logger.info('Power: Suspending')

			this.processManager.queueStopAllInstances().catch((e) => {
				this.#logger.debug(`Error suspending instances: ${e?.message ?? e}`)
			})
		}
	}

	/**
	 * Initialise instances
	 * @param extraModulePath - extra directory to search for modules
	 */
	async initInstances(extraModulePath: string): Promise<void> {
		await this.userModulesManager.init()

		await this.modules.initModules(extraModulePath)

		const instanceIds = this.#configStore.getAllInstanceIdsOfType(null)
		this.#logger.silly('instance_init', instanceIds)
		for (const id of instanceIds) {
			this.#queueUpdateInstanceState(id)
		}

		this.emit('connection_added')
		this.emit('surface_instance_added')
	}

	async reloadUsesOfModule(moduleType: ModuleInstanceType, moduleId: string, versionId: string): Promise<void> {
		// restart usages of this module
		const { instanceIds, labels } = this.#configStore.findActiveUsagesOfModule(moduleType, moduleId, versionId)
		for (const id of instanceIds) {
			// Restart it
			this.#queueUpdateInstanceState(id, false, true)
		}

		this.#logger.info(`Reloading ${labels.length} instances: ${labels.join(', ')}`)
	}

	findActiveUsagesOfModule(
		moduleType: ModuleInstanceType,
		moduleId: string,
		versionId?: string
	): { instanceIds: string[]; labels: string[] } {
		return this.#configStore.findActiveUsagesOfModule(moduleType, moduleId, versionId)
	}

	/**
	 *
	 */
	setConnectionLabelAndConfig(
		id: string,
		values: {
			label: string | null
			enabled: boolean | null
			config: unknown | null
			secrets: unknown | null
			updatePolicy: InstanceVersionUpdatePolicy | null
			upgradeIndex: number | null
		},
		options?: {
			skipNotifyConnection?: boolean
			patchSecrets?: boolean // If true, only secrets defined in the object are updated
		}
	): { ok: true } | { ok: false; message: string } {
		const connectionConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!connectionConfig) return { ok: false, message: 'no connection instance' }

		if (values.label !== null) {
			const idUsingLabel = this.getIdForLabel(ModuleInstanceType.Connection, values.label)
			if (idUsingLabel && idUsingLabel !== id) {
				return { ok: false, message: 'duplicate label' }
			}

			if (!isLabelValid(values.label)) {
				return { ok: false, message: 'invalid label' }
			}
		}

		if (values.config) {
			// Mark as definitely been initialised
			connectionConfig.isFirstInit = false

			// Update the config blob
			connectionConfig.config = values.config
		}

		if (values.secrets) {
			// Update the secrets blob
			if (options?.patchSecrets) {
				// Patch the secrets, only updating those that are defined
				connectionConfig.secrets = {
					...(connectionConfig.secrets as any),
					...values.secrets,
				}
			} else {
				connectionConfig.secrets = values.secrets
			}
		}

		// Rename variables
		if (values.label && connectionConfig.label != values.label) {
			const oldLabel = connectionConfig.label
			connectionConfig.label = values.label
			this.#variablesController.values.connectionLabelRename(oldLabel, values.label)
			this.#variablesController.definitions.connectionLabelRename(oldLabel, values.label)
			this.#controlsController.renameVariables(oldLabel, values.label)
			this.definitions.updateVariablePrefixesForLabel(id, values.label)
		}

		if (values.updatePolicy !== null) {
			connectionConfig.updatePolicy = values.updatePolicy
		}

		if (values.upgradeIndex !== null) {
			connectionConfig.lastUpgradeIndex = values.upgradeIndex
		}
		if (values.enabled !== null) {
			connectionConfig.enabled = values.enabled
		}

		this.emit('connection_updated', id)

		this.#configStore.commitChanges([id], false)

		this.#logger.debug(`instance "${connectionConfig.label}" configuration updated`)

		// If enabled has changed, start/stop the connection
		if (values.enabled !== null) {
			this.#queueUpdateInstanceState(id, false, false)
			if (!connectionConfig.enabled) {
				// If new state is disabled, stop processing here
				return { ok: true }
			}
		}

		const instance = this.processManager.getConnectionChild(id, true)
		if (values.label) {
			this.processManager.updateChildLabel(id, values.label)
		}

		const updateInstance = !!values.label || ((values.config || values.secrets) && !options?.skipNotifyConnection)
		if (updateInstance && instance) {
			instance.updateConfigAndLabel(connectionConfig).catch((e: any) => {
				instance.logger.warn('Error updating instance configuration: ' + e.message)
			})
		}

		return { ok: true }
	}

	/**
	 * Add a new instance of a module with a predetermined label
	 */
	addConnectionWithLabel(
		data: CreateConnectionData,
		labelBase: string,
		props: AddInstanceProps
	): [id: string, config: InstanceConfig] {
		const moduleId = data.type
		const product = data.product

		if (props.versionId === null) {
			// Get the latest installed version
			props.versionId = this.modules.getLatestVersionOfModule(ModuleInstanceType.Connection, moduleId, false)
		}

		// Ensure the requested module and version is installed
		this.userModulesManager.ensureModuleIsInstalled(ModuleInstanceType.Connection, moduleId, props.versionId)

		const label = this.#configStore.makeLabelUnique(ModuleInstanceType.Connection, labelBase)

		if (this.getIdForLabel(ModuleInstanceType.Connection, label)) throw new Error(`Label "${label}" already in use`)

		this.#logger.info('Adding connection ' + moduleId + ' ' + product)

		const [id, config] = this.#configStore.addConnection(moduleId, label, product, props)

		this.#queueUpdateInstanceState(id, true)

		this.#logger.silly('instance_add', id)
		this.emit('connection_added', id)

		return [id, config]
	}

	getLabelForConnection(id: string): string | undefined {
		return this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)?.label
	}

	getIdForLabel(moduleType: ModuleInstanceType, label: string): string | undefined {
		return this.#configStore.getIdFromLabel(moduleType, label)
	}

	getManifestForConnection(id: string): ModuleManifest | undefined {
		const config = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!config) return undefined

		const moduleManifest = this.modules.getModuleManifest(
			ModuleInstanceType.Connection,
			config.instance_type,
			config.moduleVersionId
		)

		if (moduleManifest?.type !== ModuleInstanceType.Connection) return undefined

		return moduleManifest?.manifest
	}

	enableDisableConnection(id: string, state: boolean): void {
		const connectionConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (connectionConfig) {
			const label = connectionConfig.label
			if (connectionConfig.enabled !== state) {
				this.#logger.info((state ? 'Enable' : 'Disable') + ' instance ' + label)
				connectionConfig.enabled = state

				this.#configStore.commitChanges([id], false)

				this.#queueUpdateInstanceState(id, false, true)
			} else {
				if (state === true) {
					this.#logger.warn(`Attempting to enable connection "${label}" that is already enabled`)
				} else {
					this.#logger.warn(`Attempting to disable connection "${label}" that is already disabled`)
				}
			}
		}
	}

	async removeConnection(connectionId: string): Promise<void> {
		const config = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!config) {
			this.#logger.warn(`Can't delete connection "${connectionId}" which does not exist!`)
			return
		}

		const label = config.label
		this.#logger.info(`Deleting instance: ${label ?? connectionId}`)

		try {
			this.processManager.queueUpdateInstanceState(connectionId, null, true)
		} catch (e) {
			this.#logger.debug(`Error while deleting instance "${label ?? connectionId}": `, e)
		}

		this.status.forgetInstanceStatus(connectionId)
		this.#configStore.forgetInstance(connectionId)

		this.emit('connection_deleted', connectionId)

		// forward cleanup elsewhere
		this.definitions.forgetConnection(connectionId)
		this.#variablesController.values.forgetConnection(connectionId, label)
		this.#variablesController.definitions.forgetConnection(connectionId, label)
		this.#controlsController.forgetConnection(connectionId)
	}

	async deleteAllConnections(deleteCollections: boolean): Promise<void> {
		const ps: Promise<void>[] = []
		for (const connectionId of this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
			ps.push(this.removeConnection(connectionId))
		}

		if (deleteCollections) {
			this.#connectionCollectionsController.discardAllCollections()
		}

		await Promise.all(ps)
	}

	/**
	 * Get information for the metrics system about the current connections
	 */
	getConnectionsMetrics(): Record<string, Record<string, number>> {
		return this.#configStore.getModuleVersionsMetrics(ModuleInstanceType.Connection)
	}

	/**
	 * Add a new surface instance with a predetermined label
	 */
	addSurfaceInstanceWithLabel(
		moduleId: string,
		labelBase: string,
		props: AddInstanceProps
	): [id: string, config: InstanceConfig] {
		if (props.versionId === null) {
			// Get the latest installed version
			props.versionId = this.modules.getLatestVersionOfModule(ModuleInstanceType.Surface, moduleId, false)
		}

		// Ensure the requested module and version is installed
		this.userModulesManager.ensureModuleIsInstalled(ModuleInstanceType.Surface, moduleId, props.versionId)

		const label = this.#configStore.makeLabelUnique(ModuleInstanceType.Surface, labelBase)

		if (this.getIdForLabel(ModuleInstanceType.Surface, label)) throw new Error(`Label "${label}" already in use`)

		this.#logger.info('Adding surface module ' + moduleId)

		delete props.collectionId // Surfaces don't use collections
		const [id, config] = this.#configStore.addSurface(moduleId, label, props)

		this.#queueUpdateInstanceState(id, true)

		this.#logger.silly(`surface_instance_added: ${id}`)
		this.emit('surface_instance_added', id)

		return [id, config]
	}

	enableDisableSurfaceInstance(id: string, state: boolean): void {
		const surfaceConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Surface)
		if (surfaceConfig) {
			const label = surfaceConfig.label
			if (surfaceConfig.enabled !== state) {
				this.#logger.info((state ? 'Enable' : 'Disable') + ' surface ' + label)
				surfaceConfig.enabled = state

				this.#configStore.commitChanges([id], false)

				this.#queueUpdateInstanceState(id, false, true)
			} else {
				if (state === true) {
					this.#logger.warn(`Attempting to enable surface "${label}" that is already enabled`)
				} else {
					this.#logger.warn(`Attempting to disable surface "${label}" that is already disabled`)
				}
			}
		}
	}

	async removeSurfaceInstance(instanceId: string): Promise<void> {
		const config = this.#configStore.getConfigOfTypeForId(instanceId, ModuleInstanceType.Surface)
		if (!config) {
			this.#logger.warn(`Can't delete surface instance "${instanceId}" which does not exist!`)
			return
		}

		const label = config.label
		this.#logger.info(`Deleting surface instance: ${label ?? instanceId}`)

		try {
			this.processManager.queueUpdateInstanceState(instanceId, null, true)
		} catch (e) {
			this.#logger.debug(`Error while deleting surface instance "${label ?? instanceId}": `, e)
		}

		this.status.forgetInstanceStatus(instanceId)
		this.#configStore.forgetInstance(instanceId)

		this.emit('surface_instance_deleted', instanceId)

		// forward cleanup elsewhere
		this.#broadcastSurfaceInstanceChanges([instanceId])
		this.#surfacesController.outbound.removeAllForSurfaceInstance(instanceId)
	}

	setSurfaceInstanceLabelAndConfig(
		instanceId: string,
		data: {
			label: string | null
			enabled: boolean | null
			config: unknown | null
			updatePolicy: InstanceVersionUpdatePolicy | null
		}
	): { ok: true } | { ok: false; message: string } {
		const surfaceConfig = this.#configStore.getConfigOfTypeForId(instanceId, ModuleInstanceType.Surface)
		if (!surfaceConfig) return { ok: false, message: 'no surface instance' }

		if (data.label !== null) {
			const idUsingLabel = this.getIdForLabel(ModuleInstanceType.Surface, data.label)
			if (idUsingLabel && idUsingLabel !== instanceId) {
				return { ok: false, message: 'duplicate label' }
			}

			if (!isLabelValid(data.label)) {
				return { ok: false, message: 'invalid label' }
			}
		}

		if (data.label !== null) {
			surfaceConfig.label = data.label
		}
		if (data.config !== null) {
			surfaceConfig.config = data.config
		}
		if (data.updatePolicy !== null) {
			surfaceConfig.updatePolicy = data.updatePolicy
		}
		if (data.enabled !== null) {
			surfaceConfig.enabled = data.enabled
		}

		this.#configStore.commitChanges([instanceId], false)

		this.#logger.debug(`surface instance "${surfaceConfig?.label}" configuration updated`)

		// If enabled has changed, start/stop the connection
		if (data.enabled !== null) {
			this.#queueUpdateInstanceState(instanceId, false, false)
			if (!surfaceConfig.enabled) {
				// If new state is disabled, stop processing here
				return { ok: true }
			}
		}

		return { ok: true }
	}

	getSurfaceInstanceClientJson(): Record<string, ClientSurfaceInstanceConfig> {
		const result: Record<string, ClientSurfaceInstanceConfig> = {}

		for (const [id, config] of this.#configStore.getAllInstanceConfigs()) {
			if (config.moduleInstanceType !== ModuleInstanceType.Surface) continue

			const instance = this.processManager.getSurfaceChild(id)

			result[id] = {
				id: id,
				moduleType: config.moduleInstanceType,
				moduleId: config.instance_type,
				moduleVersionId: config.moduleVersionId,
				updatePolicy: config.updatePolicy,
				label: config.label,
				enabled: config.enabled,
				sortOrder: config.sortOrder,
				collectionId: config.collectionId ?? null,

				remoteConfigFields: instance?.features.supportsRemote?.configFields ?? null,
				remoteConfigMatches: instance?.features.supportsRemote?.configMatchesExpression ?? null,
			}
		}

		return result
	}

	/**
	 * Inform clients of changes to the list of surfaces
	 */
	#broadcastSurfaceInstanceChanges(instanceIds: string[]): void {
		const newJson = this.getSurfaceInstanceClientJson()

		const changes: ClientSurfaceInstancesUpdate[] = []

		for (const surfaceId of instanceIds) {
			if (!newJson[surfaceId]) {
				changes.push({ type: 'remove', id: surfaceId })
			} else {
				changes.push({ type: 'update', id: surfaceId, info: newJson[surfaceId] })
			}
		}

		// Now broadcast to any interested clients
		if (this.listenerCount('uiSurfaceInstancesUpdate') > 0) {
			this.emit('uiSurfaceInstancesUpdate', changes)
		}
	}

	/**
	 * Get information for the metrics system about the current surfaces
	 */
	getSurfacesMetrics(): Record<string, Record<string, number>> {
		return this.#configStore.getModuleVersionsMetrics(ModuleInstanceType.Surface)
	}

	setModuleVersionAndActivate(
		instanceId: string,
		newVersionId: string | null,
		newUpdatePolicy: InstanceVersionUpdatePolicy | null
	): boolean {
		const config = this.#configStore.getConfigOfTypeForId(instanceId, null)
		if (!config) return false

		// Don't validate the version, as it might not yet be installed
		// const moduleInfo = instanceController.modules.getModuleManifest(config.instance_type, versionId)
		// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.instance_type} (${versionId})`)

		if (newVersionId?.includes('@')) {
			// Its a moduleId and version
			const [moduleId, version] = newVersionId.split('@')
			config.instance_type = moduleId
			config.moduleVersionId = version || null
		} else {
			// Its a simple version
			config.moduleVersionId = newVersionId
		}

		// Update the config
		if (newUpdatePolicy) config.updatePolicy = newUpdatePolicy
		this.#configStore.commitChanges([instanceId], false)

		// Install the module if needed
		this.userModulesManager.ensureModuleIsInstalled(
			config.moduleInstanceType,
			config.instance_type,
			config.moduleVersionId
		)

		// Trigger a restart (or as much as possible)
		if (config.enabled) {
			this.#queueUpdateInstanceState(instanceId, false, true)
		}

		return true
	}

	/**
	 * Stop/destroy all running instances
	 */
	async shutdownAllInstances(): Promise<void> {
		return this.processManager.queueStopAllInstances()
	}

	/**
	 * Inform clients of changes to the list of connections
	 */
	#broadcastConnectionChanges(connectionIds: string[]): void {
		const newJson = this.getConnectionClientJson(false)

		const changes: ClientConnectionsUpdate[] = []

		if (!this.#lastClientJson) {
			this.#lastClientJson = structuredClone(newJson)

			for (const connectionId of Object.keys(newJson)) {
				changes.push({ type: 'update', id: connectionId, info: newJson[connectionId] })
			}
		} else {
			for (const connectionId of connectionIds) {
				if (!newJson[connectionId]) {
					delete this.#lastClientJson[connectionId]

					changes.push({ type: 'remove', id: connectionId })
				} else {
					this.#lastClientJson[connectionId] = structuredClone(newJson[connectionId])

					changes.push({ type: 'update', id: connectionId, info: newJson[connectionId] })
				}
			}
		}

		// Now broadcast to any interested clients
		if (this.listenerCount('uiConnectionsUpdate') > 0) {
			this.emit('uiConnectionsUpdate', changes)
		}
	}

	/**
	 *
	 */
	exportConnection(
		connectionId: string,
		minimal = false,
		clone = true,
		includeSecrets = true
	): ExportInstanceFullv6 | ExportInstanceMinimalv6 | undefined {
		const rawObj = this.#configStore.getConfigOfTypeForId(connectionId, ModuleInstanceType.Connection)
		if (!rawObj) return undefined

		const obj = minimal
			? ({
					instance_type: rawObj.instance_type,
					label: rawObj.label,
					lastUpgradeIndex: rawObj.lastUpgradeIndex,
					moduleVersionId: rawObj.moduleVersionId ?? undefined,
					updatePolicy: rawObj.updatePolicy,
					sortOrder: rawObj.sortOrder,
					collectionId: rawObj.collectionId,
				} satisfies Complete<ExportInstanceMinimalv6>)
			: ({
					...rawObj,
					moduleVersionId: rawObj.moduleVersionId ?? undefined,
					secrets: includeSecrets ? rawObj.secrets : undefined,
				} satisfies ExportInstanceFullv6)

		return clone ? structuredClone(obj) : obj
	}

	exportAllConnections(includeSecrets: boolean): Record<string, InstanceConfig | undefined> {
		return this.#configStore.exportAllConnections(includeSecrets)
	}

	exportAllSurfaceInstances(): Record<string, InstanceConfig | undefined> {
		return this.#configStore.exportAllSurfaceInstances()
	}

	/**
	 * Get the status of an instance
	 */
	getInstanceStatus(connectionId: string): InstanceStatusEntry | undefined {
		return this.status.getInstanceStatus(connectionId)
	}

	/**
	 * Get the config object of an instance
	 */
	getInstanceConfigOfType(connectionId: string, instanceType: ModuleInstanceType | null): InstanceConfig | undefined {
		return this.#configStore.getConfigOfTypeForId(connectionId, instanceType)
	}

	#queueUpdateAllConnectionState(type: ModuleInstanceType | null): void {
		// Queue an update of all connections
		for (const id of this.#configStore.getAllInstanceIdsOfType(type)) {
			try {
				this.#queueUpdateInstanceState(id)
			} catch (e) {
				this.#logger.error(`Error updating connection state for ${id}: `, e)
			}
		}
	}

	/**
	 * Start an instance running
	 */
	#queueUpdateInstanceState(id: string, forceCommitChanges = false, forceRestart = false): void {
		const config = this.#configStore.getConfigOfTypeForId(id, null)
		if (!config) throw new Error('Cannot activate unknown module')

		let changed = false

		// Seamless fixup old configs
		if (!config.moduleVersionId) {
			config.moduleVersionId = this.modules.getLatestVersionOfModule(
				config.moduleInstanceType,
				config.instance_type,
				true
			)
			changed = !!config.moduleVersionId
		}

		if (config.moduleInstanceType === ModuleInstanceType.Connection) {
			// Ensure that the label is valid according to the new rules
			// This is excessive to do at every activation, but it needs to be done once everything is loaded, not when upgrades are run
			const safeLabel = makeLabelSafe(config.label)
			if (safeLabel !== config.label) {
				this.setConnectionLabelAndConfig(
					id,
					{
						label: safeLabel,
						enabled: null,
						config: null,
						secrets: null,
						updatePolicy: null,
						upgradeIndex: null,
					},
					{ skipNotifyConnection: true }
				)
				changed = true
			}
		}

		if (changed || forceCommitChanges) {
			// If we changed the config, we need to commit it
			this.#configStore.commitChanges([id], false)
		}

		let enableInstance = config.enabled !== false
		if (
			config.moduleInstanceType === ModuleInstanceType.Connection &&
			!this.#connectionCollectionsController.isCollectionEnabled(config.collectionId)
		)
			enableInstance = false
		else if (
			config.moduleInstanceType === ModuleInstanceType.Surface &&
			!this.#surfaceInstanceCollectionsController.isCollectionEnabled(config.collectionId)
		)
			enableInstance = false

		this.processManager.queueUpdateInstanceState(
			id,
			enableInstance
				? {
						label: config.label,
						moduleType: config.moduleInstanceType,
						moduleId: config.instance_type,
						moduleVersionId: config.moduleVersionId,
					}
				: null,
			forceRestart
		)
	}

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<InstanceControllerEvents> = this

		return router({
			definitions: this.definitions.createTrpcRouter(),

			modules: this.modules.createTrpcRouter(),
			modulesManager: this.userModulesManager.createTrpcRouter(),
			modulesStore: this.modulesStore.createTrpcRouter(),
			statuses: this.status.createTrpcRouter(),

			connections: createConnectionsTrpcRouter(this.#logger, this, this, this.#configStore),

			surfaces: createSurfacesTrpcRouter(this.#logger, this, this, this.#configStore),

			debugLog: publicProcedure
				.input(
					z.object({
						instanceId: z.string(),
					})
				)
				.subscription(async function* ({ signal, input }) {
					if (!self.#configStore.getConfigOfTypeForId(input.instanceId, null))
						throw new Error(`Unknown instanceId ${input.instanceId}`)

					const lines = toIterable(selfEvents, `debugLog:${input.instanceId}`, signal)

					for await (const [time, source, level, message] of lines) {
						yield { time, source, level, message }
					}
				}),
		})
	}

	getConnectionClientJson(allowCached: boolean): Record<string, ClientConnectionConfig> {
		if (allowCached && this.#lastClientJson) return this.#lastClientJson

		const result = this.#configStore.getPartialClientConnectionsJson()

		for (const [id, config] of Object.entries(result)) {
			const instance = this.processManager.getConnectionChild(id, true)
			if (instance) {
				config.hasRecordActionsHandler = instance.hasRecordActionsHandler
			}
		}

		// Cache it for next time
		if (!this.#lastClientJson) this.#lastClientJson = structuredClone(result)

		return result
	}
}

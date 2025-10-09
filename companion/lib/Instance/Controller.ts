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
import { ModuleHost } from './Host.js'
import { InstanceStatus } from './Status.js'
import { cloneDeep } from 'lodash-es'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { InstanceModules } from './Modules.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import {
	ClientConnectionConfig,
	ClientConnectionsUpdate,
	ConnectionConfig,
	ConnectionUpdatePolicy,
	ModuleInstanceType,
} from '@companion-app/shared/Model/Connections.js'
import type { ModuleManifest } from '@companion-module/base'
import type { ExportInstanceFullv6, ExportInstanceMinimalv6 } from '@companion-app/shared/Model/ExportModel.js'
import { AddConnectionProps, InstanceConfigStore } from './ConfigStore.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import { InstanceSharedUdpManager } from './SharedUdpManager.js'
import type { ServiceOscSender } from '../Service/OscSender.js'
import type { DataDatabase } from '../Data/Database.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import express from 'express'
import { InstanceInstalledModulesManager } from './InstalledModulesManager.js'
import { ModuleStoreService } from './ModuleStore.js'
import type { AppInfo } from '../Registry.js'
import type { DataCache } from '../Data/Cache.js'
import { InstanceCollections } from './Collections.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { Complete } from '@companion-module/base/dist/util.js'
import { createConnectionsTrpcRouter } from './Connection/TrpcRouter.js'

type CreateConnectionData = {
	type: string
	product?: string
}

export interface InstanceControllerEvents {
	connection_added: [connectionId?: string]
	connection_updated: [connectionId: string]
	connection_deleted: [connectionId: string]
	connection_collections_enabled: []

	uiConnectionsUpdate: [changes: ClientConnectionsUpdate[]]
	[id: `debugLog:${string}`]: [level: string, message: string]
}

export class InstanceController extends EventEmitter<InstanceControllerEvents> {
	readonly #logger = LogController.createLogger('Instance/Controller')

	readonly #controlsController: ControlsController
	readonly #variablesController: VariablesController
	readonly #collectionsController: InstanceCollections

	readonly #configStore: InstanceConfigStore

	#lastClientJson: Record<string, ClientConnectionConfig> | null = null

	readonly definitions: InstanceDefinitions
	readonly status: InstanceStatus
	readonly moduleHost: ModuleHost
	readonly modules: InstanceModules
	readonly sharedUdpManager: InstanceSharedUdpManager
	readonly modulesStore: ModuleStoreService
	readonly userModulesManager: InstanceInstalledModulesManager

	readonly connectionApiRouter = express.Router()

	get collections(): InstanceCollections {
		return this.#collectionsController
	}

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		cache: DataCache,
		apiRouter: express.Router,
		controls: ControlsController,
		graphics: GraphicsController,
		variables: VariablesController,
		oscSender: ServiceOscSender
	) {
		super()
		this.setMaxListeners(0)

		this.#variablesController = variables
		this.#controlsController = controls

		this.#configStore = new InstanceConfigStore(db, (connectionIds, updateConnectionHost) => {
			// Ensure any changes to collectionId update the enabled state
			if (updateConnectionHost) {
				for (const connectionId of connectionIds) {
					try {
						this.#queueUpdateConnectionState(connectionId, true, false)
					} catch (e) {
						this.#logger.warn(`Error updating connection state for ${connectionId}: `, e)
					}
				}
			}

			this.#broadcastConnectionChanges(connectionIds)
		})
		this.#collectionsController = new InstanceCollections(db, this.#configStore, () => {
			this.emit('connection_collections_enabled')

			this.#queueUpdateAllConnectionState()
		})

		this.sharedUdpManager = new InstanceSharedUdpManager()
		this.definitions = new InstanceDefinitions(this.#configStore)
		this.status = new InstanceStatus()
		this.modules = new InstanceModules(this, apiRouter, appInfo.modulesDirs)
		this.moduleHost = new ModuleHost(
			{
				controls: controls,
				variables: variables,
				oscSender: oscSender,

				instanceDefinitions: this.definitions,
				instanceStatus: this.status,
				sharedUdpManager: this.sharedUdpManager,
				setConnectionConfig: (connectionId, config, secrets, upgradeIndex) => {
					this.setInstanceLabelAndConfig(
						connectionId,
						{
							label: null,
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
				debugLogLine: (connectionId: string, level: string, message: string) => {
					this.emit(`debugLog:${connectionId}`, level, message)
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

		graphics.on('resubscribeFeedbacks', () => this.moduleHost.resubscribeAllFeedbacks())

		this.connectionApiRouter.use('/:label', (req, res, _next) => {
			const label = req.params.label
			const connectionId = this.getIdForLabel(label) || label
			const instance = this.moduleHost.getChild(connectionId)
			if (instance) {
				instance.executeHttpRequest(req, res)
			} else {
				res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
			}
		})

		// Prepare for clients already
		this.#broadcastConnectionChanges(this.#configStore.getInstanceIdsForAllTypes())
	}

	getAllInstanceIds(): string[] {
		return this.#configStore.getInstanceIdsForAllTypes()
	}

	/**
	 * Handle an electron power event
	 */
	powerStatusChange(event: string): void {
		if (event == 'resume') {
			this.#logger.info('Power: Resuming')

			for (const id of this.#configStore.getInstanceIdsForAllTypes()) {
				this.#queueUpdateConnectionState(id)
			}
		} else if (event == 'suspend') {
			this.#logger.info('Power: Suspending')

			this.moduleHost.queueStopAllConnections().catch((e) => {
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

		const connectionIds = this.#configStore.getInstanceIdsForAllTypes()
		this.#logger.silly('instance_init', connectionIds)
		for (const id of connectionIds) {
			this.#queueUpdateConnectionState(id)
		}

		this.emit('connection_added')
	}

	async reloadUsesOfModule(_moduleType: ModuleInstanceType, moduleId: string, versionId: string): Promise<void> {
		// restart usages of this module
		const { connectionIds, labels } = this.#configStore.findActiveUsagesOfModule(moduleId, versionId)
		for (const id of connectionIds) {
			// Restart it
			this.#queueUpdateConnectionState(id, false, true)
		}

		this.#logger.info(`Reloading ${labels.length} connections: ${labels.join(', ')}`)
	}

	findActiveUsagesOfModule(
		_moduleType: ModuleInstanceType,
		moduleId: string,
		versionId?: string
	): { connectionIds: string[]; labels: string[] } {
		return this.#configStore.findActiveUsagesOfModule(moduleId, versionId)
	}

	/**
	 *
	 */
	setInstanceLabelAndConfig(
		id: string,
		values: {
			label: string | null
			config: unknown | null
			secrets: unknown | null
			updatePolicy: ConnectionUpdatePolicy | null
			upgradeIndex: number | null
		},
		options?: {
			skipNotifyConnection?: boolean
			patchSecrets?: boolean // If true, only secrets defined in the object are updated
		}
	): void {
		const connectionConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!connectionConfig) {
			this.#logger.warn(`setInstanceLabelAndConfig id "${id}" does not exist!`)
			return
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

		this.emit('connection_updated', id)

		this.#configStore.commitChanges([id], false)

		const instance = this.moduleHost.getChild(id, true)
		if (values.label) {
			this.moduleHost.updateChildLabel(id, values.label)
		}

		const updateInstance = !!values.label || ((values.config || values.secrets) && !options?.skipNotifyConnection)
		if (updateInstance && instance) {
			instance.updateConfigAndLabel(connectionConfig).catch((e: any) => {
				instance.logger.warn('Error updating instance configuration: ' + e.message)
			})
		}

		this.#logger.debug(`instance "${connectionConfig.label}" configuration updated`)
	}

	/**
	 * Add a new instance of a module with a predetermined label
	 */
	addInstanceWithLabel(
		data: CreateConnectionData,
		labelBase: string,
		props: AddConnectionProps
	): [id: string, config: ConnectionConfig] {
		const moduleId = data.type
		const product = data.product

		if (props.versionId === null) {
			// Get the latest installed version
			props.versionId = this.modules.getLatestVersionOfModule(ModuleInstanceType.Connection, moduleId, false)
		}

		// Ensure the requested module and version is installed
		this.userModulesManager.ensureModuleIsInstalled(ModuleInstanceType.Connection, moduleId, props.versionId)

		const label = this.#configStore.makeLabelUnique(labelBase)

		if (this.getIdForLabel(label)) throw new Error(`Label "${label}" already in use`)

		this.#logger.info('Adding connection ' + moduleId + ' ' + product)

		const [id, config] = this.#configStore.addConnection(moduleId, label, product, props)

		this.#queueUpdateConnectionState(id, true)

		this.#logger.silly('instance_add', id)
		this.emit('connection_added', id)

		return [id, config]
	}

	getLabelForInstance(id: string): string | undefined {
		return this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)?.label
	}

	getIdForLabel(label: string): string | undefined {
		return this.#configStore.getIdFromLabel(label)
	}

	getManifestForInstance(id: string): ModuleManifest | undefined {
		const config = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!config) return undefined

		const moduleManifest = this.modules.getModuleManifest(
			ModuleInstanceType.Connection,
			config.instance_type,
			config.moduleVersionId
		)

		return moduleManifest?.manifest
	}

	enableDisableInstance(id: string, state: boolean): void {
		const connectionConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (connectionConfig) {
			const label = connectionConfig.label
			if (connectionConfig.enabled !== state) {
				this.#logger.info((state ? 'Enable' : 'Disable') + ' instance ' + label)
				connectionConfig.enabled = state

				this.#configStore.commitChanges([id], false)

				this.#queueUpdateConnectionState(id, false, true)
			} else {
				if (state === true) {
					this.#logger.warn(`Attempting to enable connection "${label}" that is already enabled`)
				} else {
					this.#logger.warn(`Attempting to disable connection "${label}" that is already disabled`)
				}
			}
		}
	}

	async deleteInstance(id: string): Promise<void> {
		const config = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!config) {
			this.#logger.warn(`Can't delete connection "${id}" which does not exist!`)
			return
		}

		const label = config.label
		this.#logger.info(`Deleting instance: ${label ?? id}`)

		try {
			this.moduleHost.queueUpdateConnectionState(id, null, true)
		} catch (e) {
			this.#logger.debug(`Error while deleting instance "${label ?? id}": `, e)
		}

		this.status.forgetInstanceStatus(id)
		this.#configStore.forgetConnection(id)

		this.emit('connection_deleted', id)

		// forward cleanup elsewhere
		this.definitions.forgetConnection(id)
		this.#variablesController.values.forgetConnection(id, label)
		this.#variablesController.definitions.forgetConnection(id, label)
		this.#controlsController.forgetConnection(id)
	}

	async deleteAllInstances(deleteCollections: boolean): Promise<void> {
		const ps: Promise<void>[] = []
		for (const instanceId of this.#configStore.getInstanceIdsForAllTypes()) {
			ps.push(this.deleteInstance(instanceId))
		}

		if (deleteCollections) {
			this.#collectionsController.discardAllCollections()
		}

		await Promise.all(ps)
	}

	/**
	 * Get information for the metrics system about the current connections
	 */
	getConnectionsMetrics(): Record<string, Record<string, number>> {
		return this.#configStore.getModuleVersionsMetrics()
	}

	/**
	 * Stop/destroy all running instances
	 */
	async destroyAllInstances(): Promise<void> {
		return this.moduleHost.queueStopAllConnections()
	}

	/**
	 * Inform clients of changes to the list of connections
	 */
	#broadcastConnectionChanges(connectionIds: string[]): void {
		const newJson = this.getConnectionClientJson(false)

		const changes: ClientConnectionsUpdate[] = []

		if (!this.#lastClientJson) {
			this.#lastClientJson = cloneDeep(newJson)

			for (const connectionId of Object.keys(newJson)) {
				changes.push({ type: 'update', id: connectionId, info: newJson[connectionId] })
			}
		} else {
			for (const connectionId of connectionIds) {
				if (!newJson[connectionId]) {
					delete this.#lastClientJson[connectionId]

					changes.push({ type: 'remove', id: connectionId })
				} else {
					this.#lastClientJson[connectionId] = cloneDeep(newJson[connectionId])

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
	exportInstance(
		instanceId: string,
		minimal = false,
		clone = true,
		includeSecrets = true
	): ExportInstanceFullv6 | ExportInstanceMinimalv6 | undefined {
		const rawObj = this.#configStore.getConfigOfTypeForId(instanceId, null)
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

		return clone ? cloneDeep(obj) : obj
	}

	exportAll(includeSecrets: boolean): Record<string, ConnectionConfig | undefined> {
		return this.#configStore.exportAll(includeSecrets)
	}

	/**
	 * Get the status of an instance
	 */
	getConnectionStatus(connectionId: string): InstanceStatusEntry | undefined {
		return this.status.getInstanceStatus(connectionId)
	}

	/**
	 * Get the config object of an instance
	 */
	getInstanceConfig(connectionId: string): ConnectionConfig | undefined {
		return this.#configStore.getConfigOfTypeForId(connectionId, null)
	}

	#queueUpdateAllConnectionState(): void {
		// Queue an update of all connections
		for (const id of this.#configStore.getInstanceIdsForAllTypes()) {
			try {
				this.#queueUpdateConnectionState(id)
			} catch (e) {
				this.#logger.error(`Error updating connection state for ${id}: `, e)
			}
		}
	}

	/**
	 * Start an instance running
	 */
	#queueUpdateConnectionState(id: string, forceCommitChanges = false, forceRestart = false): void {
		const config = this.#configStore.getConfigOfTypeForId(id, null)
		if (!config) throw new Error('Cannot activate unknown module')

		let changed = false

		// Seamless fixup old configs
		if (!config.moduleVersionId) {
			config.moduleVersionId = this.modules.getLatestVersionOfModule(
				ModuleInstanceType.Connection,
				config.instance_type,
				true
			)
			changed = !!config.moduleVersionId
		}

		// Ensure that the label is valid according to the new rules
		// This is excessive to do at every activation, but it needs to be done once everything is loaded, not when upgrades are run
		const safeLabel = makeLabelSafe(config.label)
		if (safeLabel !== config.label) {
			this.setInstanceLabelAndConfig(
				id,
				{
					label: safeLabel,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				},
				{ skipNotifyConnection: true }
			)
			changed = true
		}

		if (changed || forceCommitChanges) {
			// If we changed the config, we need to commit it
			this.#configStore.commitChanges([id], false)
		}

		const enableConnection = config.enabled !== false && this.collections.isCollectionEnabled(config.collectionId)

		this.moduleHost.queueUpdateConnectionState(
			id,
			enableConnection
				? {
						label: config.label,
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
			collections: this.collections.createTrpcRouter(),
			definitions: this.definitions.createTrpcRouter(),

			modules: this.modules.createTrpcRouter(),
			modulesManager: this.userModulesManager.createTrpcRouter(),
			modulesStore: this.modulesStore.createTrpcRouter(),
			statuses: this.status.createTrpcRouter(),

			connections: createConnectionsTrpcRouter(
				this.#logger,
				this,
				this,
				this.#configStore,
				this.#queueUpdateConnectionState.bind(this)
			),

			debugLog: publicProcedure
				.input(
					z.object({
						connectionId: z.string(),
					})
				)
				.subscription(async function* ({ signal, input }) {
					if (!self.#configStore.getConfigOfTypeForId(input.connectionId, null))
						throw new Error(`Unknown connectionId ${input.connectionId}`)

					const lines = toIterable(selfEvents, `debugLog:${input.connectionId}`, signal)

					for await (const [level, message] of lines) {
						yield { level, message }
					}
				}),
		})
	}

	getConnectionClientJson(allowCached: boolean): Record<string, ClientConnectionConfig> {
		if (allowCached && this.#lastClientJson) return this.#lastClientJson

		const result = this.#configStore.getPartialClientJson()

		for (const [id, config] of Object.entries(result)) {
			const instance = this.moduleHost.getChild(id, true)
			if (instance) {
				config.hasRecordActionsHandler = instance.hasRecordActionsHandler
			}
		}

		// Cache it for next time
		if (!this.#lastClientJson) this.#lastClientJson = cloneDeep(result)

		return result
	}
}

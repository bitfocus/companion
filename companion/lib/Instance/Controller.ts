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
import { cloneDeep } from 'lodash-es'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { InstanceModules } from './Modules.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { ClientConnectionConfig, ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import {
	InstanceConfig,
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
} from '@companion-app/shared/Model/Instance.js'
import type { ModuleManifest } from '@companion-module/base'
import type { ExportInstanceFullv6, ExportInstanceMinimalv6 } from '@companion-app/shared/Model/ExportModel.js'
import { AddInstanceProps, InstanceConfigStore } from './ConfigStore.js'
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
import { InstanceCollections } from './Collections.js'
import { Complete } from '@companion-module/base/dist/util.js'
import { createConnectionsTrpcRouter } from './Connection/TrpcRouter.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'

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
	readonly processManager: InstanceProcessManager
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
		})
		this.#collectionsController = new InstanceCollections(db, this.#configStore, () => {
			this.emit('connection_collections_enabled')

			this.#queueUpdateAllConnectionState()
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
				setInstanceConfig: (connectionId, config, secrets, upgradeIndex) => {
					this.setConnectionLabelAndConfig(
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

		graphics.on('resubscribeFeedbacks', () => this.processManager.resubscribeAllFeedbacks())

		this.connectionApiRouter.use('/:label', (req, res, _next) => {
			const label = req.params.label
			const connectionId = this.getIdForLabel(label) || label
			const connection = this.processManager.getConnectionChild(connectionId)
			if (connection) {
				connection.executeHttpRequest(req, res)
			} else {
				res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
			}
		})

		// Prepare for clients already
		this.#broadcastConnectionChanges(this.#configStore.getAllConnectionIds())
	}

	getAllConnectionIds(): string[] {
		return this.#configStore.getAllConnectionIds()
	}

	getInstanceIdsForAllTypes(): string[] {
		return this.#configStore.getInstanceIdsForAllTypes()
	}

	/**
	 * Handle an electron power event
	 */
	powerStatusChange(event: string): void {
		if (event == 'resume') {
			this.#logger.info('Power: Resuming')

			for (const id of this.#configStore.getInstanceIdsForAllTypes()) {
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

		const instanceIds = this.#configStore.getInstanceIdsForAllTypes()
		this.#logger.silly('instance_init', instanceIds)
		for (const id of instanceIds) {
			this.#queueUpdateInstanceState(id)
		}

		this.emit('connection_added')
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
			config: unknown | null
			secrets: unknown | null
			updatePolicy: InstanceVersionUpdatePolicy | null
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

		this.#logger.debug(`instance "${connectionConfig.label}" configuration updated`)
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

		if (this.getIdForLabel(label)) throw new Error(`Label "${label}" already in use`)

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

	getIdForLabel(label: string): string | undefined {
		return this.#configStore.getConnectionIdFromLabel(label)
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
		for (const connectionId of this.#configStore.getAllConnectionIds()) {
			ps.push(this.removeConnection(connectionId))
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
		return this.#configStore.getModuleVersionsMetrics(ModuleInstanceType.Connection)
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

		return clone ? cloneDeep(obj) : obj
	}

	exportAllConnections(includeSecrets: boolean): Record<string, InstanceConfig | undefined> {
		return this.#configStore.exportAllConnections(includeSecrets)
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

	#queueUpdateAllConnectionState(): void {
		// Queue an update of all connections
		for (const id of this.#configStore.getAllConnectionIds()) {
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
			!this.collections.isCollectionEnabled(config.collectionId)
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
				this.#queueUpdateInstanceState.bind(this)
			),

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

					for await (const [level, message] of lines) {
						yield { level, message }
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
		if (!this.#lastClientJson) this.#lastClientJson = cloneDeep(result)

		return result
	}
}

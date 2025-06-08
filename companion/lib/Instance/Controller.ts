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
import { ModuleHost, ConnectionDebugLogRoom } from './Host.js'
import { InstanceStatus } from './Status.js'
import { cloneDeep } from 'lodash-es'
import { isLabelValid, makeLabelSafe } from '@companion-app/shared/Label.js'
import { InstanceModules } from './Modules.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import {
	ClientConnectionConfig,
	ClientConnectionsUpdate,
	ConnectionConfig,
	ConnectionUpdatePolicy,
} from '@companion-app/shared/Model/Connections.js'
import type { ModuleManifest } from '@companion-module/base'
import type { ExportInstanceFullv6, ExportInstanceMinimalv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import { ConnectionConfigStore } from './ConnectionConfigStore.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import { InstanceSharedUdpManager } from './SharedUdpManager.js'
import type { ServiceOscSender } from '../Service/OscSender.js'
import type { DataDatabase } from '../Data/Database.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { PageController } from '../Page/Controller.js'
import express from 'express'
import { InstanceInstalledModulesManager } from './InstalledModulesManager.js'
import { ModuleStoreService } from './ModuleStore.js'
import type { AppInfo } from '../Registry.js'
import type { DataCache } from '../Data/Cache.js'
import { translateOptionsIsVisible } from './Wrapper.js'
import { InstanceCollections } from './Collections.js'

const InstancesRoom = 'instances'

type CreateConnectionData = {
	type: string
	product?: string
}

interface InstanceControllerEvents {
	connection_added: [connectionId?: string]
	connection_updated: [connectionId: string]
	connection_deleted: [connectionId: string]
}

export class InstanceController extends EventEmitter<InstanceControllerEvents> {
	readonly #logger = LogController.createLogger('Instance/Controller')

	readonly #io: UIHandler
	readonly #controlsController: ControlsController
	readonly #variablesController: VariablesController
	readonly #collectionsController: InstanceCollections

	readonly #configStore: ConnectionConfigStore

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
		io: UIHandler,
		db: DataDatabase,
		cache: DataCache,
		apiRouter: express.Router,
		controls: ControlsController,
		graphics: GraphicsController,
		page: PageController,
		variables: VariablesController,
		oscSender: ServiceOscSender
	) {
		super()

		this.#io = io
		this.#variablesController = variables
		this.#controlsController = controls

		this.#configStore = new ConnectionConfigStore(db, this.broadcastChanges.bind(this))
		this.#collectionsController = new InstanceCollections(io, db, this.#configStore)

		this.sharedUdpManager = new InstanceSharedUdpManager()
		this.definitions = new InstanceDefinitions(io, controls, graphics, variables.values)
		this.status = new InstanceStatus(io, controls)
		this.modules = new InstanceModules(io, this, apiRouter, appInfo.modulesDir)
		this.moduleHost = new ModuleHost(
			{
				controls: controls,
				io: io,
				variables: variables,
				page: page,
				oscSender: oscSender,

				instanceDefinitions: this.definitions,
				instanceStatus: this.status,
				sharedUdpManager: this.sharedUdpManager,
				setConnectionConfig: (connectionId, config) => {
					this.setInstanceLabelAndConfig(connectionId, null, config, null, true)
				},
			},
			this.modules,
			this.#configStore
		)
		this.modulesStore = new ModuleStoreService(appInfo, io, cache)
		this.userModulesManager = new InstanceInstalledModulesManager(
			appInfo,
			db,
			io,
			this.modules,
			this.modulesStore,
			this.#configStore,
			appInfo.modulesDir,
			(connectionId) => {
				this.enableDisableInstance(connectionId, false)
				this.enableDisableInstance(connectionId, true)
			}
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
		this.broadcastChanges(this.#configStore.getAllInstanceIds())
	}

	getAllInstanceIds(): string[] {
		return this.#configStore.getAllInstanceIds()
	}

	/**
	 * Handle an electron power event
	 */
	powerStatusChange(event: string): void {
		if (event == 'resume') {
			this.#logger.info('Power: Resuming')

			for (const id of this.#configStore.getAllInstanceIds()) {
				this.#activate_module(id)
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

		await this.modules.initInstances(extraModulePath)

		const connectionIds = this.#configStore.getAllInstanceIds()
		this.#logger.silly('instance_init', connectionIds)
		for (const id of connectionIds) {
			this.#activate_module(id, false)
		}

		this.emit('connection_added')
	}

	async reloadUsesOfModule(moduleId: string, versionId: string): Promise<void> {
		// restart usages of this module
		const { connectionIds, labels } = this.#configStore.findActiveUsagesOfModule(moduleId)
		for (const id of connectionIds) {
			// Skip any that we know are not using this version
			const config = this.#configStore.getConfigForId(id)
			if (config && config.moduleVersionId !== versionId) continue

			// Restart it
			this.enableDisableInstance(id, false)
			this.enableDisableInstance(id, true)
		}

		this.#logger.info(`Reloading ${labels.length} connections: ${labels.join(', ')}`)
	}

	/**
	 *
	 */
	setInstanceLabelAndConfig(
		id: string,
		newLabel: string | null,
		config: unknown | null,
		updatePolicy: ConnectionUpdatePolicy | null,
		skip_notify_instance = false
	): void {
		const connectionConfig = this.#configStore.getConfigForId(id)
		if (!connectionConfig) {
			this.#logger.warn(`setInstanceLabelAndConfig id "${id}" does not exist!`)
			return
		}

		if (config) {
			// Mark as definitely been initialised
			connectionConfig.isFirstInit = false

			// Update the config blob
			connectionConfig.config = config
		}

		// Rename variables
		if (newLabel && connectionConfig.label != newLabel) {
			const oldLabel = connectionConfig.label
			connectionConfig.label = newLabel
			this.#variablesController.values.connectionLabelRename(oldLabel, newLabel)
			this.#variablesController.definitions.connectionLabelRename(oldLabel, newLabel)
			this.#controlsController.renameVariables(oldLabel, newLabel)
			this.definitions.updateVariablePrefixesForLabel(id, newLabel)
		}

		if (updatePolicy !== null) {
			connectionConfig.updatePolicy = updatePolicy
		}

		this.emit('connection_updated', id)

		this.#configStore.commitChanges([id])

		const instance = this.moduleHost.getChild(id, true)
		if (newLabel) {
			this.moduleHost.updateChildLabel(id, newLabel)
		}

		const updateInstance = !!newLabel || (config && !skip_notify_instance)
		if (updateInstance && instance) {
			instance.updateConfigAndLabel(connectionConfig.config, connectionConfig.label).catch((e: any) => {
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
		versionId: string | null,
		updatePolicy: ConnectionUpdatePolicy,
		disabled: boolean
	): [id: string, config: ConnectionConfig] {
		let moduleId = data.type
		let product = data.product

		if (versionId === null) {
			// Get the latest installed version
			versionId = this.modules.getLatestVersionOfModule(moduleId, false)
		}

		// Ensure the requested module and version is installed
		this.userModulesManager.ensureModuleIsInstalled(moduleId, versionId)

		const label = this.#configStore.makeLabelUnique(labelBase)

		if (this.getIdForLabel(label)) throw new Error(`Label "${label}" already in use`)

		this.#logger.info('Adding connection ' + moduleId + ' ' + product)

		const [id, config] = this.#configStore.addConnection(moduleId, label, product, versionId, updatePolicy, disabled)

		this.#activate_module(id, true)

		this.#logger.silly('instance_add', id)
		this.#configStore.commitChanges([id])

		this.emit('connection_added', id)

		return [id, config]
	}

	getLabelForInstance(id: string): string | undefined {
		return this.#configStore.getConfigForId(id)?.label
	}

	getIdForLabel(label: string): string | undefined {
		return this.#configStore.getIdFromLabel(label)
	}

	getManifestForInstance(id: string): ModuleManifest | undefined {
		const config = this.#configStore.getConfigForId(id)
		if (!config) return undefined

		const moduleManifest = this.modules.getModuleManifest(config.instance_type, config.moduleVersionId)

		return moduleManifest?.manifest
	}

	enableDisableInstance(id: string, state: boolean): void {
		const connectionConfig = this.#configStore.getConfigForId(id)
		if (connectionConfig) {
			const label = connectionConfig.label
			if (connectionConfig.enabled !== state) {
				this.#logger.info((state ? 'Enable' : 'Disable') + ' instance ' + label)
				connectionConfig.enabled = state

				this.#configStore.commitChanges([id])

				if (state === false) {
					this.moduleHost
						.queueStopConnection(id)
						.catch((e) => {
							this.#logger.warn(`Error disabling instance ${label}: ` + e)
						})
						.then(() => {
							this.status.updateInstanceStatus(id, null, 'Disabled')

							this.definitions.forgetConnection(id)
							this.#variablesController.values.forgetConnection(id, label)
							this.#variablesController.definitions.forgetConnection(id, label)
							this.#controlsController.clearConnectionState(id)
						})
				} else {
					this.#activate_module(id)
				}
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
		const config = this.#configStore.getConfigForId(id)
		if (!config) {
			this.#logger.warn(`Can't delete connection "${id}" which does not exist!`)
			return
		}

		const label = config.label
		this.#logger.info(`Deleting instance: ${label ?? id}`)

		try {
			await this.moduleHost.queueStopConnection(id)
		} catch (e) {
			this.#logger.debug(`Error while deleting instance "${label ?? id}": `, e)
		}

		this.status.forgetConnectionStatus(id)
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
		for (const instanceId of this.#configStore.getAllInstanceIds()) {
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
	broadcastChanges(connectionIds: string[]): void {
		const newJson = this.getClientJson()

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
		if (this.#io.countRoomMembers(InstancesRoom) > 0) {
			this.#io.emitToRoom(InstancesRoom, `connections:patch`, changes)
		}
	}

	/**
	 *
	 */
	exportInstance(
		instanceId: string,
		minimal = false,
		clone = true
	): ExportInstanceFullv6 | ExportInstanceMinimalv6 | undefined {
		const rawObj = this.#configStore.getConfigForId(instanceId)
		if (!rawObj) return undefined

		const obj = minimal
			? ({
					instance_type: rawObj.instance_type,
					label: rawObj.label,
					lastUpgradeIndex: rawObj.lastUpgradeIndex,
				} satisfies ExportInstanceMinimalv6)
			: ({
					...rawObj,
					moduleVersionId: rawObj.moduleVersionId ?? undefined,
				} satisfies ExportInstanceFullv6)

		return clone ? cloneDeep(obj) : obj
	}

	exportAll(clone = true): Record<string, ConnectionConfig | undefined> {
		return this.#configStore.exportAll(clone)
	}

	/**
	 * Get the status of an instance
	 */
	getConnectionStatus(connectionId: string): ConnectionStatusEntry | undefined {
		return this.status.getConnectionStatus(connectionId)
	}

	/**
	 * Get the config object of an instance
	 */
	getInstanceConfig(connectionId: string): ConnectionConfig | undefined {
		return this.#configStore.getConfigForId(connectionId)
	}

	/**
	 * Start an instance running
	 */
	#activate_module(id: string, is_being_created = false): void {
		const config = this.#configStore.getConfigForId(id)
		if (!config) throw new Error('Cannot activate unknown module')

		// Seamless fixup old configs
		if (!config.moduleVersionId) {
			config.moduleVersionId = this.modules.getLatestVersionOfModule(config.instance_type, true)
		}

		if (config.enabled === false) {
			this.#logger.silly("Won't load disabled module " + id + ' (' + config.instance_type + ')')
			this.status.updateInstanceStatus(id, null, 'Disabled')
			return
		} else {
			this.status.updateInstanceStatus(id, null, 'Starting')
		}

		// Ensure that the label is valid according to the new rules
		// This is excessive to do at every activation, but it needs to be done once everything is loaded, not when upgrades are run
		const safeLabel = makeLabelSafe(config.label)
		if (!is_being_created && safeLabel !== config.label) {
			this.setInstanceLabelAndConfig(id, safeLabel, null, null, true)
		}

		// TODO this could check if anything above changed, or is_being_created
		this.#configStore.commitChanges([id])

		const moduleInfo = this.modules.getModuleManifest(config.instance_type, config.moduleVersionId)
		if (!moduleInfo) {
			this.#logger.error('Configured instance ' + config.instance_type + ' could not be loaded, unknown module')
			if (this.modules.hasModule(config.instance_type)) {
				this.status.updateInstanceStatus(id, 'system', 'Unknown module version')
			} else {
				this.status.updateInstanceStatus(id, 'system', 'Unknown module')
			}
		} else {
			this.moduleHost.queueRestartConnection(id, config, moduleInfo).catch((e) => {
				this.#logger.error('Configured instance ' + config.instance_type + ' failed to start: ', e)
			})
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.#variablesController.clientConnect(client)
		this.definitions.clientConnect(client)
		this.status.clientConnect(client)
		this.modules.clientConnect(client)
		this.modulesStore.clientConnect(client)
		this.userModulesManager.clientConnect(client)
		this.#collectionsController.clientConnect(client)

		client.onPromise('connections:subscribe', () => {
			client.join(InstancesRoom)

			return this.#lastClientJson || this.getClientJson()
		})
		client.onPromise('connections:unsubscribe', () => {
			client.leave(InstancesRoom)
		})

		client.onPromise('connections:edit', async (id) => {
			// Check if the instance exists
			const instanceConf = this.#configStore.getConfigForId(id)
			if (!instanceConf) return null

			const instance = this.moduleHost.getChild(id)
			if (!instance) return null

			try {
				// TODO: making types match is messy
				const fields: any = await instance.requestConfigFields()

				return {
					fields: translateOptionsIsVisible(fields) as any[],
					config: instanceConf.config,
				}
			} catch (e: any) {
				this.#logger.silly(`Failed to load instance config_fields: ${e.message}`)
				return null
			}
		})

		client.onPromise('connections:set-label-and-config', (id, label, config, updatePolicy) => {
			const idUsingLabel = this.getIdForLabel(label)
			if (idUsingLabel && idUsingLabel !== id) {
				return 'duplicate label'
			}

			if (!isLabelValid(label)) {
				return 'invalid label'
			}

			this.setInstanceLabelAndConfig(id, label, config, updatePolicy)

			return null
		})

		client.onPromise('connections:set-label-and-version', (id, label, versionId, updatePolicy) => {
			this.#logger.info('Setting label and version', id, label, versionId)
			const idUsingLabel = this.getIdForLabel(label)
			if (idUsingLabel && idUsingLabel !== id) {
				return 'duplicate label'
			}

			if (!isLabelValid(label)) {
				return 'invalid label'
			}

			// TODO - refactor/optimise/tidy this

			this.setInstanceLabelAndConfig(id, label, null, null)

			const config = this.#configStore.getConfigForId(id)
			if (!config) return 'no connection'

			// Don't validate the version, as it might not yet be installed
			// const moduleInfo = this.modules.getModuleManifest(config.instance_type, versionId)
			// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.instance_type} (${versionId})`)

			if (versionId?.includes('@')) {
				// Its a moduleId and version
				const [moduleId, version] = versionId.split('@')
				config.instance_type = moduleId
				config.moduleVersionId = version || null
			} else {
				// Its a simple version
				config.moduleVersionId = versionId
			}

			// Update the config
			if (updatePolicy) config.updatePolicy = updatePolicy
			this.#configStore.commitChanges([id])

			// Install the module if needed
			const moduleInfo = this.modules.getModuleManifest(config.instance_type, config.moduleVersionId)
			if (!moduleInfo) {
				this.userModulesManager.ensureModuleIsInstalled(config.instance_type, config.moduleVersionId)
			}

			// Trigger a restart (or as much as possible)
			if (config.enabled) {
				this.enableDisableInstance(id, false)
				this.enableDisableInstance(id, true)
			}

			return null
		})

		client.onPromise('connections:set-module-and-version', (connectionId, moduleId, versionId) => {
			const config = this.#configStore.getConfigForId(connectionId)
			if (!config) return 'no connection'

			// Don't validate the version, as it might not yet be installed
			// const moduleInfo = this.modules.getModuleManifest(config.instance_type, versionId)
			// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.instance_type} (${versionId})`)

			// Update the config
			config.instance_type = moduleId
			config.moduleVersionId = versionId
			// if (updatePolicy) config.updatePolicy = updatePolicy
			this.#configStore.commitChanges([connectionId])

			// Install the module if needed
			const moduleInfo = this.modules.getModuleManifest(config.instance_type, versionId)
			if (!moduleInfo) {
				this.userModulesManager.ensureModuleIsInstalled(config.instance_type, versionId)
			}

			// Trigger a restart (or as much as possible)
			if (config.enabled) {
				this.enableDisableInstance(connectionId, false)
				this.enableDisableInstance(connectionId, true)
			}

			return null
		})

		client.onPromise('connections:set-enabled', (id, state) => {
			this.enableDisableInstance(id, !!state)
		})

		client.onPromise('connections:delete', async (id) => {
			await this.deleteInstance(id)
		})

		client.onPromise('connections:add', (module, label, version) => {
			const connectionInfo = this.addInstanceWithLabel(module, label, version, ConnectionUpdatePolicy.Stable, false)
			return connectionInfo[0]
		})

		client.onPromise('connections:reorder', async (collectionId, connectionId, dropIndex) => {
			this.#configStore.moveConnection(collectionId, connectionId, dropIndex)
		})

		client.onPromise('connection-debug:subscribe', (connectionId) => {
			if (!this.#configStore.getConfigForId(connectionId)) return false

			client.join(ConnectionDebugLogRoom(connectionId))

			return true
		})

		client.onPromise('connection-debug:unsubscribe', (connectionId) => {
			client.leave(ConnectionDebugLogRoom(connectionId))
		})
	}

	getClientJson(): Record<string, ClientConnectionConfig> {
		const result = this.#configStore.getPartialClientJson()

		for (const [id, config] of Object.entries(result)) {
			const instance = this.moduleHost.getChild(id, true)
			if (instance) {
				config.hasRecordActionsHandler = instance.hasRecordActionsHandler
			}
		}

		return result
	}
}

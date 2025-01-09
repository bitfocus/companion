/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
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
import type {
	ClientConnectionConfig,
	ClientConnectionsUpdate,
	ConnectionConfig,
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

	readonly #configStore: ConnectionConfigStore

	#lastClientJson: Record<string, ClientConnectionConfig> | null = null

	readonly definitions: InstanceDefinitions
	readonly status: InstanceStatus
	readonly moduleHost: ModuleHost
	readonly modules: InstanceModules
	readonly sharedUdpManager: InstanceSharedUdpManager

	readonly connectionApiRouter = express.Router()

	constructor(
		io: UIHandler,
		db: DataDatabase,
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

		this.sharedUdpManager = new InstanceSharedUdpManager()
		this.definitions = new InstanceDefinitions(io, controls, graphics, variables.values)
		this.status = new InstanceStatus(io, controls)
		this.modules = new InstanceModules(io, this, apiRouter)
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
					this.setInstanceLabelAndConfig(connectionId, null, config, true)
				},
			},
			this.modules,
			this.#configStore
		)

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
		const connectionIds = this.#configStore.getAllInstanceIds()
		this.#logger.silly('instance_init', connectionIds)

		await this.modules.initInstances(extraModulePath)

		for (const id of connectionIds) {
			this.#activate_module(id, false)
		}

		this.emit('connection_added')
	}

	reloadUsesOfModule(moduleId: string): void {
		// restart usages of this module
		const { connectionIds, labels } = this.#configStore.findActiveUsagesOfModule(moduleId)
		for (const id of connectionIds) {
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
	 * Add a new instance of a module
	 */
	addInstance(data: CreateConnectionData, disabled: boolean): string {
		let module = data.type

		const moduleInfo = this.modules.getModuleManifest(module)
		if (!moduleInfo) throw new Error(`Unknown module type ${module}`)

		return this.addInstanceWithLabel(data, moduleInfo.display.shortname, disabled)[0]
	}

	/**
	 * Add a new instance of a module with a predetermined label
	 */
	addInstanceWithLabel(
		data: CreateConnectionData,
		labelBase: string,
		disabled: boolean
	): [id: string, config: ConnectionConfig] {
		let module = data.type
		let product = data.product

		const label = this.#configStore.makeLabelUnique(labelBase)

		if (this.getIdForLabel(label)) throw new Error(`Label "${label}" already in use`)

		this.#logger.info('Adding connection ' + module + ' ' + product)

		const [id, config] = this.#configStore.addConnection(module, label, product, disabled)

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

		const moduleManifest = this.modules.getModuleManifest(config.instance_type)

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

	async deleteAllInstances(): Promise<void> {
		const ps = []
		for (const instanceId of this.#configStore.getAllInstanceIds()) {
			ps.push(this.deleteInstance(instanceId))
		}

		await Promise.all(ps)
	}

	/**
	 * Get information for the metrics system about the current instances
	 */
	getInstancesMetrics(): Record<string, number> {
		return this.#configStore.getInstancesMetrics()
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
			? {
					instance_type: rawObj.instance_type,
					label: rawObj.label,
					lastUpgradeIndex: rawObj.lastUpgradeIndex,
				}
			: {
					...rawObj,
				}

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

		config.instance_type = this.modules.verifyInstanceTypeIsCurrent(config.instance_type)

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
			this.setInstanceLabelAndConfig(id, safeLabel, null, true)
		}

		// TODO this could check if anything above changed, or is_being_created
		this.#configStore.commitChanges([id])

		const moduleInfo = this.modules.getModuleManifest(config.instance_type)
		if (!moduleInfo) {
			this.#logger.error('Configured instance ' + config.instance_type + ' could not be loaded, unknown module')
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
					fields,
					config: instanceConf.config,
				}
			} catch (e: any) {
				this.#logger.silly(`Failed to load instance config_fields: ${e.message}`)
				return null
			}
		})

		client.onPromise('connections:set-config', (id, label, config) => {
			const idUsingLabel = this.getIdForLabel(label)
			if (idUsingLabel && idUsingLabel !== id) {
				return 'duplicate label'
			}

			if (!isLabelValid(label)) {
				return 'invalid label'
			}

			this.setInstanceLabelAndConfig(id, label, config)

			return null
		})

		client.onPromise('connections:set-enabled', (id, state) => {
			this.enableDisableInstance(id, !!state)
		})

		client.onPromise('connections:delete', async (id) => {
			await this.deleteInstance(id)
		})

		client.onPromise('connections:add', (module) => {
			const id = this.addInstance(module, false)
			return id
		})

		client.onPromise('connections:set-order', async (connectionIds) => {
			if (!Array.isArray(connectionIds)) throw new Error('Expected array of ids')

			this.#configStore.setOrder(connectionIds)
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

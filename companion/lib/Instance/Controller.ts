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

import { EventEmitter } from 'node:events'
import express from 'express'
import type { UdevRuleDefinition } from 'udev-generator'
import z from 'zod'
import { isLabelValid, makeLabelSafe } from '@companion-app/shared/Label.js'
import type { ClientConnectionConfig, ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ExportInstanceFullv6, ExportInstanceMinimalv6 } from '@companion-app/shared/Model/ExportModel.js'
import {
	InstanceVersionUpdatePolicy,
	ModuleInstanceType,
	type InstanceConfig,
} from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type { ModuleManifestExt } from '@companion-app/shared/Model/ModuleManifest.js'
import type {
	ClientSurfaceInstanceConfig,
	ClientSurfaceInstancesUpdate,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Complete } from '@companion-module/base'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { DataCache } from '../Data/Cache.js'
import type { DataDatabase } from '../Data/Database.js'
import type { LabeledValue, MetricsRegistry } from '../Data/Metrics.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { ServiceOscSender } from '../Service/OscSender.js'
import type { SurfaceController } from '../Surface/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { VariablesController } from '../Variables/Controller.js'
import { ActionRecorder } from './ActionRecorder.js'
import { InstanceConfigStore, type AddInstanceProps } from './ConfigStore.js'
import { ConnectionsCollections } from './Connection/Collections.js'
import { InstanceSharedUdpManager } from './Connection/SharedUdpManager.js'
import { createConnectionsTrpcRouter } from './Connection/TrpcRouter.js'
import { InstanceDefinitions } from './Definitions.js'
import { InstanceInstalledModulesManager } from './InstalledModulesManager.js'
import { InstanceModules } from './Modules.js'
import { ModuleStoreService } from './ModuleStore.js'
import { InstanceProcessManager } from './ProcessManager.js'
import { createInstanceRestApiRouter } from './RestApi.js'
import { InstanceStatus } from './Status.js'
import { SurfaceInstanceCollections } from './Surface/Collections.js'
import { createSurfacesTrpcRouter } from './Surface/TrpcRouter.js'
import { InstanceUdevRulesController } from './UdevRules.js'

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

	readonly #controlsStore: IControlStore
	readonly #variablesController: VariablesController
	readonly #surfacesController: SurfaceController
	readonly #connectionCollectionsController: ConnectionsCollections
	readonly #surfaceInstanceCollectionsController: SurfaceInstanceCollections
	readonly #udevRules: InstanceUdevRulesController

	readonly #configStore: InstanceConfigStore

	#lastClientJson: Record<string, ClientConnectionConfig> | null = null

	/**
	 * Cumulative per-instance counters that must survive child restarts. The child handlers (and the
	 * counters on them) are recreated on restart, so these live here, keyed by instanceId, and the handlers
	 * increment into them. Exposed as metrics counters.
	 */
	readonly #instanceCounters = new Map<
		string,
		{
			feedbackValuesReceived: number
			variableValuesReceived: number
			ipcMessagesSent: number
			ipcMessagesReceived: number
			ipcBytesSent: number
			ipcBytesReceived: number
		}
	>()

	#instanceCounter(instanceId: string) {
		let counter = this.#instanceCounters.get(instanceId)
		if (!counter) {
			counter = {
				feedbackValuesReceived: 0,
				variableValuesReceived: 0,
				ipcMessagesSent: 0,
				ipcMessagesReceived: 0,
				ipcBytesSent: 0,
				ipcBytesReceived: 0,
			}
			this.#instanceCounters.set(instanceId, counter)
		}
		return counter
	}

	readonly definitions: InstanceDefinitions
	readonly status: InstanceStatus
	readonly processManager: InstanceProcessManager
	readonly modules: InstanceModules
	readonly sharedUdpManager: InstanceSharedUdpManager
	readonly actionRecorder: ActionRecorder
	readonly modulesStore: ModuleStoreService
	readonly userModulesManager: InstanceInstalledModulesManager

	readonly connectionApiRouter = express.Router()

	get connectionCollections(): ConnectionsCollections {
		return this.#connectionCollectionsController
	}
	get surfaceInstanceCollections(): SurfaceInstanceCollections {
		return this.#surfaceInstanceCollectionsController
	}

	/**
	 * Whether the collection containing an instance of the given type is enabled.
	 * Dispatches to the correct collections controller so callers don't have to.
	 */
	isCollectionEnabled(moduleType: ModuleInstanceType, collectionId: string | null | undefined): boolean {
		switch (moduleType) {
			case ModuleInstanceType.Connection:
				return this.#connectionCollectionsController.isCollectionEnabled(collectionId)
			case ModuleInstanceType.Surface:
				return this.#surfaceInstanceCollectionsController.isCollectionEnabled(collectionId)
			default:
				return false
		}
	}

	/**
	 * Whether an instance should be running: it is enabled directly AND its collection is enabled.
	 */
	isInstanceEnabled(config: InstanceConfig): boolean {
		return config.enabled !== false && this.isCollectionEnabled(config.moduleInstanceType, config.collectionId)
	}

	createRestApiRouter(logger: Logger): express.Router {
		return createInstanceRestApiRouter(logger, this, this.#configStore)
	}

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		cache: DataCache,
		apiRouter: express.Router,
		controlsStore: IControlStore,
		variables: VariablesController,
		surfaces: SurfaceController,
		oscSender: ServiceOscSender,
		metrics: MetricsRegistry
	) {
		super()
		this.setMaxListeners(0)

		this.#variablesController = variables
		this.#surfacesController = surfaces
		this.#controlsStore = controlsStore
		this.#udevRules = new InstanceUdevRulesController(appInfo.udevRulesDir, () => this.#collectSurfaceUsbIds())

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
		this.actionRecorder = new ActionRecorder(this, controlsStore)
		this.modules = new InstanceModules(this, apiRouter, appInfo)
		this.processManager = new InstanceProcessManager(
			{
				controls: controlsStore,
				variables: variables,
				oscSender: oscSender,
				actionRecorder: this.actionRecorder,

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
				trackFeedbackValuesReceived: (connectionId, count) => {
					this.#instanceCounter(connectionId).feedbackValuesReceived += count
				},
				trackVariableValuesReceived: (connectionId, count) => {
					this.#instanceCounter(connectionId).variableValuesReceived += count
				},
				trackIpcMessage: (instanceId, direction, bytes) => {
					const counter = this.#instanceCounter(instanceId)
					if (direction === 'sent') {
						counter.ipcMessagesSent++
						counter.ipcBytesSent += bytes
					} else {
						counter.ipcMessagesReceived++
						counter.ipcBytesReceived += bytes
					}
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
				trackIpcMessage: (instanceId, direction, bytes) => {
					const counter = this.#instanceCounter(instanceId)
					if (direction === 'sent') {
						counter.ipcMessagesSent++
						counter.ipcBytesSent += bytes
					} else {
						counter.ipcMessagesReceived++
						counter.ipcBytesReceived += bytes
					}
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

		this.#udevRules.triggerRegenerate()

		this.#registerMetrics(metrics)
	}

	/**
	 * Register per-instance metrics, owned by this controller and read live from its sub-components at
	 * scrape time. The id label is always `instance_id` (covers connections and surface integrations - a
	 * connection's id is an instance id); the `type` label on the info metric distinguishes them. Cross-cutting
	 * lifecycle metrics are `companion_instance_*`; connection-specific ones are `companion_connection_*`.
	 * Join the info metric onto the others by instance_id for the descriptive fields (label/module) - this
	 * keeps churn-prone labels off every series.
	 */
	#registerMetrics(metrics: MetricsRegistry): void {
		const configStore = this.#configStore
		const definitions = this.definitions
		const variableValues = this.#variablesController.values
		const processManager = this.processManager

		// Info metric: one series per instance, value 1, descriptive fields carried as labels
		metrics.labeledGauge(
			'companion_instance_info',
			'Information about a configured instance (constant 1, see labels)',
			['instance_id', 'label', 'module_id', 'module_version', 'type'],
			() => {
				const out: LabeledValue[] = []
				for (const [id, config] of configStore.getAllInstanceConfigs()) {
					out.push({
						labels: {
							instance_id: id,
							label: config.label,
							module_id: config.moduleId,
							module_version: config.moduleVersionId ?? '',
							type: config.moduleInstanceType,
						},
						value: 1,
					})
				}
				return out
			}
		)

		// Connections by enabled state (total = sum without(enabled))
		metrics.labeledGauge(
			'companion_connections',
			'Number of configured connections by enabled state',
			['enabled'],
			() => {
				let enabled = 0
				let disabled = 0
				for (const id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
					const config = configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
					if (config?.enabled) enabled++
					else disabled++
				}
				return [
					{ labels: { enabled: 'true' }, value: enabled },
					{ labels: { enabled: 'false' }, value: disabled },
				]
			}
		)

		// Per-connection definition counts, one series per (connection, entity_type)
		metrics.labeledGauge(
			'companion_connection_definitions',
			'Number of entity definitions a connection exposes',
			['instance_id', 'entity_type'],
			() => {
				const out: LabeledValue[] = []
				for (const id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
					const counts = definitions.getDefinitionCounts(id)
					out.push(
						{ labels: { instance_id: id, entity_type: 'action' }, value: counts.actions },
						{ labels: { instance_id: id, entity_type: 'feedback' }, value: counts.feedbacks },
						{ labels: { instance_id: id, entity_type: 'preset' }, value: counts.presets }
					)
				}
				return out
			}
		)

		// Per-connection variable count
		metrics.labeledGauge(
			'companion_connection_variables',
			'Number of variables a connection currently exposes values for',
			['instance_id'],
			() => {
				const out: LabeledValue[] = []
				for (const id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
					const label = this.getLabelForConnection(id)
					if (!label) continue
					out.push({ labels: { instance_id: id }, value: variableValues.getVariableCountForLabel(label) })
				}
				return out
			}
		)

		// Runtime: ready state (1/0)
		metrics.labeledGauge(
			'companion_instance_ready',
			'Whether an instance is currently ready/connected (1) or not (0)',
			['instance_id'],
			() =>
				processManager
					.getRuntimeMetrics()
					.map((m) => ({ labels: { instance_id: m.instanceId }, value: m.isReady ? 1 : 0 }))
		)

		// Runtime: when the instance last became ready - derive uptime as `time() - this`. Absent while not ready.
		metrics.labeledGauge(
			'companion_instance_ready_timestamp_seconds',
			'Unix time when an instance last became ready (derive uptime as time() - this)',
			['instance_id'],
			() => {
				const out: LabeledValue[] = []
				for (const m of processManager.getRuntimeMetrics()) {
					if (m.readyAt === undefined) continue
					out.push({ labels: { instance_id: m.instanceId }, value: m.readyAt / 1000 })
				}
				return out
			}
		)

		// Runtime: cumulative restarts since startup
		metrics.labeledCounter(
			'companion_instance_restarts_total',
			'Cumulative instance restarts since startup',
			['instance_id'],
			() =>
				processManager
					.getRuntimeMetrics()
					.map((m) => ({ labels: { instance_id: m.instanceId }, value: m.restartsTotal }))
		)

		// Active (enabled) feedback entities referencing each connection. Counted by walking every control's
		// entities at scrape time - O(controls x entities), acceptable for an infrequent scrape.
		metrics.labeledGauge(
			'companion_connection_active_feedbacks',
			'Number of active (enabled) feedback entities referencing a connection',
			['instance_id'],
			() => {
				const counts = new Map<string, number>()
				for (const id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) counts.set(id, 0)
				for (const control of this.#controlsStore.getAllControls().values()) {
					if (!control.supportsEntities) continue
					for (const entity of control.entities.getAllEntities()) {
						if (entity.type !== EntityModelType.Feedback || entity.disabled) continue
						const current = counts.get(entity.connectionId)
						if (current !== undefined) counts.set(entity.connectionId, current + 1)
					}
				}
				return Array.from(counts, ([instance_id, value]) => ({ labels: { instance_id }, value }))
			}
		)

		// Cumulative feedback values received from each connection's module child (see #instanceCounters).
		metrics.labeledCounter(
			'companion_connection_feedback_values_received_total',
			'Cumulative feedback values received from a connection since startup',
			['instance_id'],
			() => {
				const out: LabeledValue[] = []
				for (const instance_id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
					out.push({
						labels: { instance_id },
						value: this.#instanceCounters.get(instance_id)?.feedbackValuesReceived ?? 0,
					})
				}
				return out
			}
		)

		// Cumulative variable values received from each connection's module child (see #instanceCounters).
		// Filtered to connection ids for the same reason as the feedback counter above.
		metrics.labeledCounter(
			'companion_connection_variable_values_received_total',
			'Cumulative variable values received from a connection since startup',
			['instance_id'],
			() => {
				const out: LabeledValue[] = []
				for (const instance_id of configStore.getAllInstanceIdsOfType(ModuleInstanceType.Connection)) {
					out.push({
						labels: { instance_id },
						value: this.#instanceCounters.get(instance_id)?.variableValuesReceived ?? 0,
					})
				}
				return out
			}
		)

		// Cumulative IPC messages exchanged with each instance's module child, by direction
		metrics.labeledCounter(
			'companion_instance_ipc_messages_total',
			'Cumulative IPC messages exchanged with an instance module child, by direction',
			['instance_id', 'direction'],
			() => {
				const out: LabeledValue[] = []
				for (const [instance_id, c] of this.#instanceCounters) {
					out.push(
						{ labels: { instance_id, direction: 'sent' }, value: c.ipcMessagesSent },
						{ labels: { instance_id, direction: 'received' }, value: c.ipcMessagesReceived }
					)
				}
				return out
			}
		)

		// Cumulative IPC payload bytes exchanged with each instance's module child, by direction. Measured from
		// the already-serialized payload string at the IPC boundary - a slight under-count (excludes the small
		// fixed envelope), no extra serialization on the hot path.
		metrics.labeledCounter(
			'companion_instance_ipc_bytes_total',
			'Cumulative IPC bytes exchanged with an instance module child, by direction',
			['instance_id', 'direction'],
			() => {
				const out: LabeledValue[] = []
				for (const [instance_id, c] of this.#instanceCounters) {
					out.push(
						{ labels: { instance_id, direction: 'sent' }, value: c.ipcBytesSent },
						{ labels: { instance_id, direction: 'received' }, value: c.ipcBytesReceived }
					)
				}
				return out
			}
		)
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
	 * Setup the default surface instances
	 */
	createDefaultSurfaceInstances(): void {
		this.addSurfaceInstanceWithLabel('elgato-stream-deck', 'elgato-stream-deck', {
			versionId: 'builtin',
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
			disabled: false,
		})

		this.addSurfaceInstanceWithLabel('xkeys', 'xkeys', {
			versionId: 'builtin',
			updatePolicy: InstanceVersionUpdatePolicy.Stable,
			disabled: false,
		})
	}

	/**
	 * Initialise instances
	 * @param extraModulePath - extra directory to search for modules
	 */
	async initInstances(isFirstRun: boolean, extraModulePath: string): Promise<void> {
		await this.userModulesManager.init()

		await this.modules.initModules(extraModulePath)

		// Validate and fix surface instance states before initializing
		this.#validateAndFixSurfaceInstanceStates()

		// If this is a fresh install, setup the default surface instances
		if (isFirstRun && this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Surface).length === 0) {
			this.createDefaultSurfaceInstances()
		}

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
			if (moduleType === ModuleInstanceType.Surface) {
				const config = this.#configStore.getConfigOfTypeForId(id, moduleType)
				if (!config) continue

				// If this can no longer be enabled, disable it
				if (config.enabled && !this.#canEnableSurfaceInstance(id)) {
					config.enabled = false
					this.#configStore.commitChanges([id], false)
				}
			}

			// Restart it
			this.#queueUpdateInstanceState(id, false, true)
		}

		this.#logger.info(`Reloading ${labels.length} instances: ${labels.join(', ')}`)
	}

	#validateAndFixSurfaceInstanceStates(): void {
		// Group enabled surface integrations by module ID
		const instancesByModule = new Map<string, Array<{ instanceId: string; config: InstanceConfig }>>()
		for (const [instanceId, config] of this.#configStore.getAllInstanceConfigs()) {
			if (config.moduleInstanceType !== ModuleInstanceType.Surface) continue
			if (!config.enabled) continue

			if (!instancesByModule.has(config.moduleId)) {
				instancesByModule.set(config.moduleId, [])
			}
			instancesByModule.get(config.moduleId)!.push({ instanceId, config })
		}

		// Check each module to see if multiple instances are allowed
		for (const instances of instancesByModule.values()) {
			// If only one instance exists, there is nothing to check
			if (instances.length <= 1) continue

			// Check if ALL versions in use allow multiple instances
			let allVersionsAllowMultiple = true
			for (const { config } of instances) {
				const moduleInfo = this.modules.getModuleManifest(
					ModuleInstanceType.Surface,
					config.moduleId,
					config.moduleVersionId
				)
				// If no loaded module, skip this instance
				if (!moduleInfo || moduleInfo.manifest.type !== 'surface') continue

				if (!moduleInfo.manifest.allowMultipleInstances) {
					allVersionsAllowMultiple = false
					break
				}
			}

			// If not all versions allow multiple instances, disable all but the first
			if (!allVersionsAllowMultiple) {
				for (let i = 1; i < instances.length; i++) {
					const { instanceId, config } = instances[i]
					this.#logger.warn(
						`Disabling surface integration "${config.label}" (${instanceId}) because not all versions of this module allow multiple instances`
					)
					config.enabled = false
				}
				this.#configStore.commitChanges(
					instances.slice(1).map((i) => i.instanceId),
					false
				)
			}
		}
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
			patchConfig?: boolean // If true, only config keys defined in the object are updated (shallow merge)
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
			if (options?.patchConfig) {
				// Patch the config, only updating those keys that are defined
				connectionConfig.config = {
					...(connectionConfig.config as any),
					...values.config,
				}
			} else {
				connectionConfig.config = values.config
			}
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
			this.#controlsStore.renameVariables(oldLabel, values.label)
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
			instance.updateConfigAndLabel(connectionConfig).catch((e) => {
				instance.logger.warn('Error updating instance configuration: ' + stringifyError(e))
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

	getManifestForConnection(id: string): ModuleManifestExt | undefined {
		const config = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!config) return undefined

		const moduleManifest = this.modules.getModuleManifest(
			ModuleInstanceType.Connection,
			config.moduleId,
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

	/**
	 * Force a restart of a running connection process
	 * @returns true if the connection was found and restart was triggered
	 */
	restartConnection(id: string): boolean {
		const connectionConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Connection)
		if (!connectionConfig) return false

		if (connectionConfig.enabled === false) {
			this.#logger.warn(`Cannot restart disabled connection "${connectionConfig.label}"`)
			return false
		}

		if (!this.#connectionCollectionsController.isCollectionEnabled(connectionConfig.collectionId)) {
			this.#logger.warn(`Cannot restart connection "${connectionConfig.label}" in disabled collection`)
			return false
		}

		this.#logger.info(`Restarting connection "${connectionConfig.label}"`)
		this.#queueUpdateInstanceState(id, false, true)
		return true
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

		// Drop the per-instance metrics state so it doesn't linger for the lifetime of the process
		this.processManager.forgetInstance(connectionId)
		this.#instanceCounters.delete(connectionId)

		this.status.forgetInstanceStatus(connectionId)
		this.#configStore.forgetInstance(connectionId)

		this.emit('connection_deleted', connectionId)

		// forward cleanup elsewhere
		this.definitions.forgetConnection(connectionId)
		this.#variablesController.values.forgetConnection(connectionId, label)
		this.#variablesController.definitions.forgetConnection(connectionId, label)
		this.#controlsStore.forgetConnection(connectionId)
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

	async deleteAllSurfaceInstances(deleteCollections: boolean): Promise<void> {
		const ps: Promise<void>[] = []
		for (const surfaceId of this.#configStore.getAllInstanceIdsOfType(ModuleInstanceType.Surface)) {
			ps.push(this.removeSurfaceInstance(surfaceId))
		}

		if (deleteCollections) {
			this.#surfaceInstanceCollectionsController.discardAllCollections()
		}

		await Promise.all(ps)
	}

	/**
	 * Get information for the metrics system about the current connections
	 */
	getConnectionsMetrics(): Record<string, Record<string, number>> {
		return this.#configStore.getModuleVersionsMetrics(ModuleInstanceType.Connection)
	}

	#canEnableSurfaceInstance(instanceId: string): boolean {
		const thisConfig = this.#configStore.getConfigOfTypeForId(instanceId, ModuleInstanceType.Surface)
		if (!thisConfig) return false

		// Collect all enabled instances of this module
		const allInstancesOfModule = this.#configStore
			.getAllInstanceConfigs()
			.entries()
			.filter(
				([_id, config]) =>
					config.moduleInstanceType === ModuleInstanceType.Surface &&
					config.moduleId === thisConfig.moduleId &&
					config.enabled
			)
			.toArray()

		// If there is only one instance, then enabling is always allowed
		if (allInstancesOfModule.length <= 1) {
			return true
		}

		// Check if ALL versions in use allow multiple instances
		let allVersionsAllowMultiple = true
		for (const [_id, config] of allInstancesOfModule) {
			const moduleInfo = this.modules.getModuleManifest(
				ModuleInstanceType.Surface,
				config.moduleId,
				config.moduleVersionId
			)
			// If no loaded module, skip this instance
			if (!moduleInfo || moduleInfo.manifest.type !== 'surface') continue

			if (!moduleInfo.manifest.allowMultipleInstances) {
				allVersionsAllowMultiple = false
				break
			}
		}

		// If all versions allow multiple instances, enabling is allowed
		return allVersionsAllowMultiple
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

		this.#udevRules.triggerRegenerate()

		return [id, config]
	}

	enableDisableSurfaceInstance(id: string, state: boolean): void {
		const surfaceConfig = this.#configStore.getConfigOfTypeForId(id, ModuleInstanceType.Surface)
		if (surfaceConfig) {
			const label = surfaceConfig.label
			if (surfaceConfig.enabled !== state) {
				this.#logger.info((state ? 'Enable' : 'Disable') + ' surface ' + label)
				surfaceConfig.enabled = state

				// If enabling, check if it would violate allowMultipleInstances rule and auto-disable if so
				if (surfaceConfig.enabled && !this.#canEnableSurfaceInstance(id)) {
					this.#logger.warn(`Disabling surface "${label}" because enabling would violate allowMultipleInstances rule`)
					surfaceConfig.enabled = false
				}

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
			this.#logger.warn(`Can't delete surface integration "${instanceId}" which does not exist!`)
			return
		}

		const label = config.label
		this.#logger.info(`Deleting surface integration: ${label ?? instanceId}`)

		try {
			this.processManager.queueUpdateInstanceState(instanceId, null, true)
		} catch (e) {
			this.#logger.debug(`Error while deleting surface integration "${label ?? instanceId}": `, e)
		}

		// Drop the per-instance metrics state so it doesn't linger for the lifetime of the process
		this.processManager.forgetInstance(instanceId)
		this.#instanceCounters.delete(instanceId)

		this.status.forgetInstanceStatus(instanceId)
		this.#configStore.forgetInstance(instanceId)
		this.#udevRules.triggerRegenerate()

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
		if (!surfaceConfig) return { ok: false, message: 'no surface integration' }

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

		// If enabling, check if it would violate allowMultipleInstances rule and auto-disable if so
		let enabledChanged = false
		if (surfaceConfig.enabled && !this.#canEnableSurfaceInstance(instanceId)) {
			this.#logger.warn(
				`Disabling surface "${surfaceConfig.label}" because enabling would violate allowMultipleInstances rule`
			)
			surfaceConfig.enabled = false
			enabledChanged = true
		}

		this.emit('surface_instance_updated', instanceId)

		this.#configStore.commitChanges([instanceId], false)

		this.#logger.debug(`surface integration "${surfaceConfig?.label}" configuration updated`)

		// If enabled has changed, start/stop the connection
		if (data.enabled !== null || enabledChanged) {
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
				moduleId: config.moduleId,
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
		// const moduleInfo = instanceController.modules.getModuleManifest(config.moduleId, versionId)
		// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.moduleId} (${versionId})`)

		if (newVersionId?.includes('@')) {
			// Its a moduleId and version
			const [moduleId, version] = newVersionId.split('@')
			config.moduleId = moduleId
			config.moduleVersionId = version || null
		} else {
			// Its a simple version
			config.moduleVersionId = newVersionId
		}

		// If this is an enabled surface instance, check if the new version would violate allowMultipleInstances
		if (
			config.enabled &&
			config.moduleInstanceType === ModuleInstanceType.Surface &&
			!this.#canEnableSurfaceInstance(instanceId)
		) {
			this.#logger.warn(
				`Disabling surface "${config.label}" because changing to version ${config.moduleVersionId} would violate allowMultipleInstances rule`
			)
			config.enabled = false
		}

		// Update the config
		if (newUpdatePolicy) config.updatePolicy = newUpdatePolicy
		this.#configStore.commitChanges([instanceId], false)

		// Install the module if needed
		this.userModulesManager.ensureModuleIsInstalled(config.moduleInstanceType, config.moduleId, config.moduleVersionId)

		// Trigger a restart (or as much as possible)
		if (config.enabled) {
			this.#queueUpdateInstanceState(instanceId, false, true)
		} else if (config.moduleInstanceType === ModuleInstanceType.Surface) {
			this.#udevRules.triggerRegenerate()
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
					moduleId: rawObj.moduleId,
					label: rawObj.label,
					lastUpgradeIndex: rawObj.lastUpgradeIndex,
					moduleVersionId: rawObj.moduleVersionId ?? undefined,
					updatePolicy: rawObj.updatePolicy,
					sortOrder: rawObj.sortOrder,
					collectionId: rawObj.collectionId,
				} satisfies Complete<ExportInstanceMinimalv6>)
			: ({
					...rawObj,
					moduleId: rawObj.moduleId, // Rename for export
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
			config.moduleVersionId = this.modules.getLatestVersionOfModule(config.moduleInstanceType, config.moduleId, true)
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
		} else if (config.moduleInstanceType === ModuleInstanceType.Surface) {
			// Ensure the udev rules are up to date
			this.#udevRules.triggerRegenerate()
		}

		if (changed || forceCommitChanges) {
			// If we changed the config, we need to commit it
			this.#configStore.commitChanges([id], false)
		}

		const enableInstance = this.isInstanceEnabled(config)

		this.processManager.queueUpdateInstanceState(
			id,
			enableInstance
				? {
						label: config.label,
						moduleType: config.moduleInstanceType,
						moduleId: config.moduleId,
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

			udevRules: this.#udevRules.createTrpcRouter(),
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

	/** Gather the USB ids of all enabled surface modules, used to generate the udev rules */
	#collectSurfaceUsbIds(): UdevRuleDefinition[] {
		const usbIds: UdevRuleDefinition[] = []

		for (const config of this.#configStore.getAllInstanceConfigs().values()) {
			if (config.moduleInstanceType !== ModuleInstanceType.Surface) continue

			// Find the manifest of the module
			const manifest = this.modules.getModuleManifest(
				ModuleInstanceType.Surface,
				config.moduleId,
				config.moduleVersionId
			)
			if (!manifest || manifest.manifest.type !== 'surface') continue

			if (manifest.manifest.usbIds) usbIds.push(...manifest.manifest.usbIds)
		}

		return usbIds
	}
}

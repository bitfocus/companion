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
 */

import HID from 'node-hid'
import jsonPatch from 'fast-json-patch'
import pDebounce from 'p-debounce'
import debounceFn from 'debounce-fn'
import { usb } from 'usb'
import { SurfaceHandler, getSurfaceName } from './Handler.js'
import { SurfaceIPElgatoEmulator, EmulatorRoom } from './IP/ElgatoEmulator.js'
import { SurfaceIPElgatoPlugin } from './IP/ElgatoPlugin.js'
import { SurfaceIPSatellite, type SatelliteDeviceInfo } from './IP/Satellite.js'
import { SurfaceGroup, validateGroupConfigValue } from './Group.js'
import { SurfaceOutboundController } from './Outbound.js'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type {
	ClientDevicesListItem,
	ClientSurfaceItem,
	OutboundSurfaceInfo,
	SurfaceConfig,
	SurfaceGroupConfig,
	SurfacePanelConfig,
	SurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { ServiceElgatoPluginSocket } from '../Service/ElgatoPlugin.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { SurfaceHandlerDependencies, SurfacePanel, UpdateEvents } from './Types.js'
import { createOrSanitizeSurfaceHandlerConfig, PanelDefaults } from './Config.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import type { EmulatorListItem, EmulatorPageConfig } from '@companion-app/shared/Model/Emulator.js'
import type { SurfacePluginPanel } from './PluginPanel.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { SurfaceChildFeatures } from '../Instance/Surface/ChildHandler.js'
import type { HIDDevice } from '@companion-surface/host'
import type { Complete } from '@companion-module/base'
import {
	DiscoveredSurfaceRegistry,
	type DiscoveredSurfaceInfo,
	type SurfaceOpener,
} from '../Instance/Surface/DiscoveredSurfaceRegistry.js'
import { createHash } from 'node:crypto'
import type { CheckDeviceInfo } from '../Instance/Surface/IpcTypes.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { JsonValue } from 'type-fest'
import { JsonValueSchema } from '@companion-app/shared/Model/Options.js'

/**
 * Interface for a handler that can process HID device scans.
 * Implemented by SurfaceChildHandler to allow centralized scan coordination.
 */
export interface SurfaceScanHandler extends SurfaceOpener {
	/**
	 * Scan for surfaces
	 * This either processes HID devices to find supported surfaces, or can perform its own non-hid scan.
	 * @param hidDevices - HID devices with serialNumber already populated
	 * @returns Promise resolving to array of discovered surfaces
	 */
	scanForSurfaces(hidDevices: HIDDevice[]): Promise<DiscoveredSurfaceInfo[]>
}

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')

export interface SurfaceControllerEvents {
	surface_name: [surfaceId: string, name: string]
	surface_page: [surfaceId: string, pageId: string]
	surface_locked: [surfaceId: string, locked: boolean]
	'surface-add': [surfaceId: string]
	'surface-delete': [surfaceId: string]

	'surface-in-group': [surfaceId: string, groupId: string | null]
	'surface-config': [surfaceId: string, config: SurfacePanelConfig | null]

	group_name: [groupId: string, name: string]
	group_page: [groupId: string, pageId: string]
	'group-add': [groupId: string]
	'group-delete': [surfaceId: string]
}

export class SurfaceController extends EventEmitter<SurfaceControllerEvents> {
	readonly #logger = LogController.createLogger('Surface/Controller')

	readonly #dbTableSurfaces: DataStoreTableView<Record<string, SurfaceConfig>>
	readonly #dbTableGroups: DataStoreTableView<Record<string, SurfaceGroupConfig>>
	readonly #handlerDependencies: SurfaceHandlerDependencies

	readonly #updateEvents = new EventEmitter<UpdateEvents>()

	/**
	 * The last sent json object
	 */
	#lastSentJson: Record<string, ClientDevicesListItem> = {}

	/**
	 * All the opened and active surfaces
	 */
	readonly #surfaceHandlers = new Map<string, SurfaceHandler | null>()

	/**
	 * The surface groups wrapping the surface handlers
	 */
	readonly #surfaceGroups = new Map<string, SurfaceGroup>()

	/**
	 * Last time each surface was interacted with, for lockouts
	 * The values get cleared when a surface is locked, and remains while unlocked
	 */
	readonly #surfacesLastInteraction = new Map<string, number>()

	/**
	 * Timer for lockout checking
	 */
	#surfaceLockoutTimer: NodeJS.Timeout | null = null

	/**
	 * If lockouts are linked, track whether they are currently locked
	 */
	#surfacesAllLocked: boolean = false

	/**
	 * Whether usb hotplug is currently configured and running
	 */
	#runningUsbHotplug: boolean = false

	/**
	 * Promise for the currently running scan operation.
	 * Used by generateDiscoveredSurfaceId to wait for any in-progress scan.
	 */
	#runningScan: Promise<void> | null = null

	/**
	 * Registry of surfaces from the module discovery events.
	 * Stores `${instanceId}:${devicePath}` so we can clean up when instances are destroyed.
	 * The key is prefixed with instanceId to ensure device paths are globally unique across modules.
	 */
	readonly #discoveredSurfaces = new Set<`${string}:${string}`>()

	/**
	 * Stable device ID generator for assigning fake serials to HID devices.
	 * Centralized here so all handlers see the same collision-resolved serials.
	 */
	readonly #discoveredSurfaceRegistry = new DiscoveredSurfaceRegistry()

	/**
	 * Registered handlers for HID device scanning.
	 * Map of instanceId -> handler
	 */
	readonly #surfaceScanHandlers = new Map<string, SurfaceScanHandler>()

	readonly #outboundController: SurfaceOutboundController

	get outbound(): SurfaceOutboundController {
		return this.#outboundController
	}

	constructor(db: DataDatabase, handlerDependencies: SurfaceHandlerDependencies) {
		super()

		this.#dbTableSurfaces = db.getTableView('surfaces')
		this.#dbTableGroups = db.getTableView('surface_groups')
		this.#handlerDependencies = handlerDependencies

		this.#updateEvents.setMaxListeners(0)

		this.#outboundController = new SurfaceOutboundController(db)

		this.#surfacesAllLocked = !!this.#handlerDependencies.userconfig.getKey('link_lockouts')

		setImmediate(() => {
			// Setup groups
			const groupsConfigs = this.#dbTableGroups.all()
			for (const groupId of Object.keys(groupsConfigs)) {
				const newGroup = new SurfaceGroup(
					this,
					this.#dbTableGroups,
					this.#handlerDependencies.pageStore,
					this.#handlerDependencies.userconfig,
					this.#updateEvents,
					groupId,
					null,
					this.isPinLockEnabled()
				)
				this.#surfaceGroups.set(groupId, newGroup)
			}

			// Setup defined emulators
			const instances = this.#dbTableSurfaces.all()
			for (const id of Object.keys(instances)) {
				// If the id starts with 'emulator:' then re-add it
				if (id.startsWith('emulator:')) {
					this.addEmulator(id.substring(9), undefined)
				}
			}

			// Initial search for USB devices
			this.triggerRefreshDevices().catch(() => {
				this.#logger.warn('Initial USB scan failed')
			})
			this.#outboundController.init()

			this.triggerUpdateDevicesList()

			this.#startStopLockoutTimer()
		})

		this.triggerRefreshDevicesEvent = this.triggerRefreshDevicesEvent.bind(this)

		const runHotplug = this.#handlerDependencies.userconfig.getKey('usb_hotplug')
		if (runHotplug) {
			try {
				usb.on('attach', this.triggerRefreshDevicesEvent)
			} catch (e) {
				this.#logger.error(`Failed to enable usb hotplug: ${e}`)
			}
			this.#runningUsbHotplug = true
		}
	}

	/**
	 * Trigger a rescan of connected devices.
	 */
	triggerRefreshDevices = pDebounce(
		pDebounce.promise(async () => this.#refreshDevices()),
		50,
		{ before: false }
	)

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param key - the saved key
	 * @param value - the saved value
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		if (key === 'usb_hotplug') {
			try {
				if (!value && this.#runningUsbHotplug) {
					// Stop watching
					usb.off('attach', this.triggerRefreshDevicesEvent)
					this.#runningUsbHotplug = false
				} else if (value && !this.#runningUsbHotplug) {
					// Start watching
					usb.on('attach', this.triggerRefreshDevicesEvent)
					this.#runningUsbHotplug = true
				}
			} catch (e) {
				this.#logger.warn(`Failed to enable/disable usb hotplug: ${e}`)
			}
		} else if (key === 'pin_enable' || key === 'pin_timeout') {
			this.#startStopLockoutTimer()

			if (!this.isPinLockEnabled()) {
				// Ensure all are unlocked
				this.setAllLocked(false, true)
			}
		} else if (key === 'installName') {
			if (this.#updateEvents.listenerCount('emulatorPageConfig') > 0) {
				this.#updateEvents.emit('emulatorPageConfig', this.#compileEmulatorPageConfig())
			}
		}
	}

	#compileEmulatorPageConfig(): EmulatorPageConfig {
		return {
			installName: this.#handlerDependencies.userconfig.getKey('installName'),
		}
	}

	#compileEmulatorList(): EmulatorListItem[] {
		const items: EmulatorListItem[] = []

		for (const [id, surface] of this.#surfaceHandlers) {
			if (surface && id.startsWith('emulator:')) {
				//&& surface.panel instanceof SurfaceIPElgatoEmulator) {

				const trimmedId = id.slice('emulator:'.length)
				items.push({
					id: trimmedId,
					name: surface.getFullConfig().name ?? `Emulator (${trimmedId})`,
				})
			}
		}

		return items.sort((a, b) => a.name.localeCompare(b.name))
	}

	#startStopLockoutTimer() {
		// Stop existing timer
		if (this.#surfaceLockoutTimer) {
			clearInterval(this.#surfaceLockoutTimer)
			this.#surfaceLockoutTimer = null
		}

		// Start new timer
		const timeout = Number(this.#handlerDependencies.userconfig.getKey('pin_timeout')) * 1000
		if (!isNaN(timeout) && timeout > 0 && !!this.#handlerDependencies.userconfig.getKey('pin_enable')) {
			this.#surfaceLockoutTimer = setInterval(() => {
				if (this.#handlerDependencies.userconfig.getKey('link_lockouts')) {
					if (this.#surfacesAllLocked) return

					let latestTime = 0
					for (const surfaceGroup of this.#surfaceGroups.values()) {
						const lastInteraction = this.#surfacesLastInteraction.get(surfaceGroup.groupId) || 0
						if (lastInteraction > latestTime) {
							latestTime = lastInteraction
						}
					}

					if (latestTime + timeout < Date.now()) {
						this.setAllLocked(true)
					}
				} else {
					for (const surfaceGroup of this.#surfaceGroups.values()) {
						if (this.#isSurfaceGroupTimedOut(surfaceGroup.groupId, timeout)) {
							this.#surfacesLastInteraction.delete(surfaceGroup.groupId)
							this.setSurfaceOrGroupLocked(surfaceGroup.groupId, true)
						}
					}
				}
			}, 1000)
		}
	}

	/**
	 * Check if a surface should be timed out
	 */
	#isSurfaceGroupTimedOut(groupId: string, timeout: number): boolean {
		if (!this.isPinLockEnabled()) return false

		const lastInteraction = this.#surfacesLastInteraction.get(groupId) || 0
		return lastInteraction + timeout < Date.now()
	}

	triggerRefreshDevicesEvent = (): void => {
		this.triggerRefreshDevices().catch((e) => {
			this.#logger.warn(`Hotplug device refresh failed: ${e}`)
		})
	}

	/**
	 * Add an emulator
	 * @param id base id of the emulator
	 * @param name Name of the emulator, or undefined to use the default
	 */
	addEmulator(id: string, name: string | undefined): SurfaceHandler {
		const fullId = EmulatorRoom(id)
		if (this.#surfaceHandlers.has(fullId)) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		const handler = this.#createSurfaceHandler(fullId, 'emulator', new SurfaceIPElgatoEmulator(this.#updateEvents, id))
		if (name !== undefined) handler.setPanelName(name)

		this.triggerUpdateDevicesList()

		return handler
	}

	/**
	 * Create a `SurfaceHandler` for a `SurfacePanel`
	 */
	#createSurfaceHandler(surfaceId: string, integrationType: string, panel: SurfacePanel): SurfaceHandler {
		const existingSurfaceConfig = this.getDeviceConfig(panel.info.surfaceId)
		if (!existingSurfaceConfig) {
			this.#logger.silly(`Creating config for newly discovered device ${panel.info.surfaceId}`)
		} else {
			this.#logger.silly(`Reusing config for device ${panel.info.surfaceId}`)
		}

		const surfaceConfig = createOrSanitizeSurfaceHandlerConfig(
			integrationType,
			panel,
			existingSurfaceConfig,
			this.#handlerDependencies.userconfig.getKey('gridSize')
		)

		const handler = new SurfaceHandler(this, this.#handlerDependencies, this.#updateEvents, panel, surfaceConfig)
		handler.on('interaction', () => {
			const groupId = handler.getGroupId() || handler.surfaceId
			this.#surfacesLastInteraction.set(groupId, Date.now())
		})
		handler.on('configUpdated', (newConfig) => {
			this.setDeviceConfig(handler.surfaceId, newConfig)
		})
		handler.on('unlocked', () => {
			const groupId = handler.getGroupId() || handler.surfaceId
			this.#surfacesLastInteraction.set(groupId, Date.now())

			if (this.#handlerDependencies.userconfig.getKey('link_lockouts')) {
				this.setAllLocked(false)
			} else {
				this.setSurfaceOrGroupLocked(groupId, false)
			}
		})

		this.#surfaceHandlers.set(surfaceId, handler)
		this.emit('surface-add', surfaceId)

		// Update the group to have the new surface
		this.#attachSurfaceToGroup(handler)

		return handler
	}

	createTrpcRouter() {
		const self = this
		const selfEvents = this as EventEmitter<SurfaceControllerEvents>

		return router({
			outbound: this.#outboundController.createTrpcRouter(),

			watchSurfaces: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#updateEvents, 'surfaces', signal)

				yield [{ type: 'init', info: self.#lastSentJson }] satisfies SurfacesUpdate[]

				for await (const [info] of changes) {
					yield info
				}
			}),

			watchGroupConfig: publicProcedure
				.input(
					z.object({
						groupId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					const changes = toIterable(self.#updateEvents, `groupConfig:${input.groupId}`, signal)

					let initialData: SurfaceGroupConfig | null = null
					const group = self.#surfaceGroups.get(input.groupId)
					if (group) {
						initialData = group.groupConfig
					} else {
						// Perhaps this is an auto-group for an offline surface?
						const surfaceConfig = self.#dbTableSurfaces.get(input.groupId)
						if (surfaceConfig) {
							initialData = surfaceConfig.groupConfig
						}
					}
					yield initialData

					for await (const [change] of changes) {
						yield change
					}
				}),

			watchSurfaceConfig: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					const changes = toIterable(selfEvents, 'surface-config', signal)

					let initialData: SurfacePanelConfig | null = null
					for (const surface of self.#surfaceHandlers.values()) {
						if (surface && surface.surfaceId == input.surfaceId) {
							initialData = surface.getPanelConfig()
						}
					}

					// Maybe surface exists, but is offline?
					if (!initialData) {
						const surfaceConfig = self.#dbTableSurfaces.get(input.surfaceId)
						if (surfaceConfig) {
							initialData = surfaceConfig.config
						}
					}
					yield initialData

					for await (const [surfaceId, change] of changes) {
						if (surfaceId === input.surfaceId) yield change
					}
				}),

			rescanUsb: publicProcedure.mutation(async () => {
				try {
					return this.triggerRefreshDevices()
				} catch (e) {
					return stringifyError(e, true)
				}
			}),

			emulatorPageConfig: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#updateEvents, 'emulatorPageConfig', signal)

				yield self.#compileEmulatorPageConfig()

				for await (const [info] of changes) {
					yield info
				}
			}),

			emulatorAdd: publicProcedure
				.input(
					z.object({
						baseId: z.string().min(1),
						name: z.string().optional(),
						rows: z.number().int().min(1),
						columns: z.number().int().min(1),
					})
				)
				.mutation(async ({ input }) => {
					const fullId = `emulator:${input.baseId}`

					if (this.#surfaceHandlers.has(fullId)) throw new Error(`Emulator "${input.baseId}" already exists!`)

					const handler = this.addEmulator(input.baseId, input.name || '')

					// Update the config to include the dimensions
					handler.setPanelConfig({
						...handler.getPanelConfig(),
						emulator_rows: input.rows,
						emulator_columns: input.columns,
					})

					if (!(handler.panel instanceof SurfaceIPElgatoEmulator)) {
						throw new Error(`Emulator "${input.baseId}" was not constructed properly!`)
					}

					// Emit an update to the config
					this.#updateEvents.emit('emulatorConfig', input.baseId, handler.panel.latestConfig())

					return fullId
				}),

			emulatorRemove: publicProcedure
				.input(
					z.object({
						id: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					if (input.id.startsWith('emulator:') && this.#surfaceHandlers.has(input.id)) {
						this.removeDevice(input.id, true)

						// Emit an update to the config
						this.#updateEvents.emit('emulatorConfig', input.id.slice('emulator:'.length), null)

						return true
					} else {
						return false
					}
				}),

			emulatorList: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#updateEvents, 'emulatorList', signal)

				yield self.#compileEmulatorList()

				for await (const [info] of changes) {
					yield info
				}
			}),

			emulatorConfig: publicProcedure.input(z.object({ id: z.string() })).subscription(async function* ({
				signal,
				input,
			}) {
				const changes = toIterable(self.#updateEvents, 'emulatorConfig', signal)

				// Emit the current config if it exists
				const surface = self.#surfaceHandlers.get(EmulatorRoom(input.id))
				if (!surface || !(surface.panel instanceof SurfaceIPElgatoEmulator)) {
					yield null
				} else {
					yield surface.panel.latestConfig()
				}

				for await (const [changeId, changeData] of changes) {
					if (changeId === input.id) yield changeData
				}
			}),

			emulatorLocked: publicProcedure.input(z.object({ id: z.string() })).subscription(async function* ({
				signal,
				input,
			}) {
				const changes = toIterable(self.#updateEvents, 'emulatorLocked', signal)

				// Emit the current config if it exists
				const surface = self.#surfaceHandlers.get(EmulatorRoom(input.id))
				if (!surface || !(surface.panel instanceof SurfaceIPElgatoEmulator)) {
					yield null
				} else {
					yield surface.panel.lockedState()
				}

				for await (const [changeId, changeData] of changes) {
					if (changeId === input.id) yield changeData
				}
			}),

			emulatorImages: publicProcedure.input(z.object({ id: z.string() })).subscription(async function* ({
				signal,
				input,
			}) {
				const surface = self.#surfaceHandlers.get(EmulatorRoom(input.id))
				if (!surface || !(surface.panel instanceof SurfaceIPElgatoEmulator)) {
					throw new Error(`Emulator "${input.id}" does not exist!`)
				}

				const changes = toIterable(self.#updateEvents, 'emulatorImages', signal)

				yield { images: surface.panel.latestImages(), clearCache: true }

				for await (const [changeId, changeData, clearCache] of changes) {
					if (changeId === input.id) yield { images: changeData, clearCache }
				}
			}),

			emulatorPressed: publicProcedure
				.input(
					z.object({
						id: z.string(),
						column: z.number(),
						row: z.number(),
						pressed: z.boolean(),
					})
				)
				.mutation(async ({ input }) => {
					const surface = this.#surfaceHandlers.get(EmulatorRoom(input.id))
					if (!surface) {
						throw new Error(`Emulator "${input.id}" does not exist!`)
					}

					surface.panel.emit('click', input.column, input.row, input.pressed)
				}),

			emulatorPinEntry: publicProcedure
				.input(
					z.object({
						id: z.string(),
						digit: z.number().min(0).max(9),
					})
				)
				.mutation(async ({ input }) => {
					const surface = this.#surfaceHandlers.get(EmulatorRoom(input.id))
					if (!surface) {
						throw new Error(`Emulator "${input.id}" does not exist!`)
					}

					surface.panel.emit('pincodeKey', input.digit)
				}),

			groupAdd: publicProcedure
				.input(
					z.object({
						baseId: z.string().min(1),
						name: z.string().min(1),
					})
				)
				.mutation(async ({ input }) => {
					const groupId = `group:${input.baseId}`

					const newGroup = new SurfaceGroup(
						this,
						this.#dbTableGroups,
						this.#handlerDependencies.pageStore,
						this.#handlerDependencies.userconfig,
						this.#updateEvents,
						groupId,
						null,
						this.isPinLockEnabled()
					)
					newGroup.setName(input.name)
					this.#surfaceGroups.set(groupId, newGroup)

					this.triggerUpdateDevicesList()

					return groupId
				}),

			groupRemove: publicProcedure
				.input(
					z.object({
						groupId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					const group = this.#surfaceGroups.get(input.groupId)
					if (!group || group.isAutoGroup) throw new Error(`Group does not exist`)

					// Clear the group for all surfaces
					for (const surfaceHandler of group.surfaceHandlers) {
						surfaceHandler.setGroupId(null)
						this.#attachSurfaceToGroup(surfaceHandler)
					}

					group.dispose()
					group.forgetConfig()
					this.#surfaceGroups.delete(input.groupId)

					this.triggerUpdateDevicesList()
				}),

			groupSetConfigKey: publicProcedure
				.input(
					z.object({
						groupId: z.string(),
						key: z.string(),
						value: JsonValueSchema.optional(),
					})
				)
				.mutation(async ({ input }) => {
					const group = this.#surfaceGroups.get(input.groupId)
					if (group) {
						return group.setGroupConfigValue(input.key, input.value)
					}

					// Perhaps this is an auto-group for an offline surface?
					const surfaceConfig = this.#dbTableSurfaces.get(input.groupId)
					if (surfaceConfig && !this.#surfaceHandlers.has(input.groupId)) {
						try {
							const newValue = validateGroupConfigValue(this.#handlerDependencies.pageStore, input.key, input.value)

							;(surfaceConfig.groupConfig as any)[input.key] = newValue

							this.#dbTableSurfaces.set(input.groupId, surfaceConfig)
							this.#updateEvents.emit(`groupConfig:${input.groupId}`, surfaceConfig.groupConfig)

							return
						} catch (e) {
							throw new Error(`Failed to update value: ${stringifyError(e)}`)
						}
					}

					throw new Error(`Group does not exist: ${input.groupId}`)
				}),

			surfaceSetGroup: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
						groupId: z.string().nullable(),
					})
				)
				.mutation(async ({ input }) => {
					const group = input.groupId ? this.#surfaceGroups.get(input.groupId) : null
					if (input.groupId && !group) throw new Error(`Group does not exist: ${input.groupId}`)
					if (group && group.isAutoGroup) throw new Error(`Cannot add to an auto group: ${input.groupId}`)

					// Check for an active surface
					const surfaceHandler = this.#surfaceHandlers
						.values()
						.find((surface) => surface && surface.surfaceId === input.surfaceId)
					if (surfaceHandler) {
						this.#detachSurfaceFromGroup(surfaceHandler)

						surfaceHandler.setGroupId(input.groupId)

						this.#attachSurfaceToGroup(surfaceHandler)

						this.triggerUpdateDevicesList()
						return
					}

					// Surface not found, perhaps it is an offline surface?
					const surfaceConfig = this.#dbTableSurfaces.get(input.surfaceId)
					if (surfaceConfig) {
						surfaceConfig.groupId = input.groupId
						this.#dbTableSurfaces.set(input.surfaceId, surfaceConfig)

						this.triggerUpdateDevicesList()
						return
					}

					throw new Error(`Surface does not exist or is not connected: ${input.surfaceId}`)
				}),

			surfaceForget: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					for (const surface of this.#surfaceHandlers.values()) {
						if (!surface) continue

						if (surface.surfaceId == input.surfaceId) {
							return 'device is active'
						}
					}

					if (this.setDeviceConfig(input.surfaceId, undefined)) {
						this.triggerUpdateDevicesList()

						return true
					}

					return 'device not found'
				}),

			surfaceOrGroupSetName: publicProcedure
				.input(
					z.object({
						surfaceOrGroupId: z.string(),
						name: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					// Find a matching group
					const group = this.#surfaceGroups.get(input.surfaceOrGroupId)
					if (group && !group.isAutoGroup) {
						group.setName(input.name)
						this.triggerUpdateDevicesList()
						return
					}

					// Find a connected surface
					for (const surface of this.#surfaceHandlers.values()) {
						if (surface && surface.surfaceId == input.surfaceOrGroupId) {
							surface.setPanelName(input.name)
							this.triggerUpdateDevicesList()
							return
						}
					}

					// Find a disconnected surface
					const surfaceConfig = this.#dbTableSurfaces.get(input.surfaceOrGroupId)
					if (surfaceConfig) {
						surfaceConfig.name = input.name
						this.#dbTableSurfaces.set(input.surfaceOrGroupId, surfaceConfig)
						this.triggerUpdateDevicesList()
						return
					}

					throw new Error('not found')
				}),

			surfaceSetConfigKey: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
						key: z.string(),
						value: JsonValueSchema.optional(),
					})
				)
				.mutation(async ({ input }) => {
					for (const surface of this.#surfaceHandlers.values()) {
						if (surface && surface.surfaceId == input.surfaceId) {
							surface.setPanelConfig({
								...surface.getPanelConfig(),
								[input.key]: input.value,
							})

							// Ensure the surface has the correct locked state
							const groupId = surface.getGroupId()
							const group = groupId ? this.#surfaceGroups.get(groupId) : null
							if (group) {
								group.syncLocked()
							}

							this.triggerUpdateDevicesList()
						}
					}
					return 'device not found'
				}),

			surfaceSetEnabled: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
						enabled: z.boolean(),
					})
				)
				.mutation(async ({ input }) => {
					const surfaceConfig = this.#dbTableSurfaces.get(input.surfaceId)
					if (!surfaceConfig) {
						throw new Error(`Surface not found: ${input.surfaceId}`)
					}

					// Update the enabled field
					surfaceConfig.enabled = input.enabled
					this.#dbTableSurfaces.set(input.surfaceId, surfaceConfig)

					// If enabling a surface that is not currently open, try to open it directly
					if (input.enabled && !this.#surfaceHandlers.has(input.surfaceId)) {
						// Check if we have cached opener info for this surface
						const openerInfo = this.#discoveredSurfaceRegistry.getOpenerInfo(input.surfaceId)
						if (openerInfo) {
							// Directly open the surface using the cached handler
							this.#logger.debug(`Enabling surface ${input.surfaceId}, opening directly via cached handler`)
							openerInfo.opener.openDiscoveredSurface(openerInfo.surface, input.surfaceId).catch((e: unknown) => {
								this.#logger.warn(`Error opening enabled surface ${input.surfaceId}: ${e}`)
								// If direct open failed, fall back to a full refresh
								this.triggerRefreshDevices().catch(() => {
									this.#logger.warn('Device refresh after enable failed')
								})
							})
						} else {
							// No cached info (module-discovered surface), trigger a rescan to find it
							this.#logger.debug(`Enabling surface ${input.surfaceId}, triggering rescan (module-discovered surface)`)
							this.triggerRefreshDevices().catch(() => {
								this.#logger.warn('Device refresh after enable failed')
							})
						}
					}

					// If disabling a connected surface, close it
					if (!input.enabled) {
						const handler = this.#surfaceHandlers.get(input.surfaceId)
						if (handler) {
							this.removeDevice(input.surfaceId)
						}
					}

					this.triggerUpdateDevicesList()
				}),
		})
	}

	/**
	 * Attach a `SurfaceHandler` to its `SurfaceGroup`
	 */
	#attachSurfaceToGroup(surfaceHandler: SurfaceHandler): void {
		const rawSurfaceGroupId = surfaceHandler.getGroupId()
		const surfaceGroupId = rawSurfaceGroupId || surfaceHandler.surfaceId
		const existingGroup = this.#surfaceGroups.get(surfaceGroupId)
		if (existingGroup) {
			existingGroup.attachSurface(surfaceHandler)
		} else {
			let isLocked = false
			if (this.isPinLockEnabled()) {
				const timeout = Number(this.#handlerDependencies.userconfig.getKey('pin_timeout')) * 1000
				if (this.#handlerDependencies.userconfig.getKey('link_lockouts')) {
					isLocked = this.#surfacesAllLocked
				} else if (timeout && !isNaN(timeout)) {
					isLocked = this.#isSurfaceGroupTimedOut(surfaceGroupId, timeout)
				} else {
					isLocked = !this.#surfacesLastInteraction.has(surfaceGroupId)
				}
			}

			if (!isLocked) {
				// If not already locked, keep it unlocked for the full timeout
				this.#surfacesLastInteraction.set(surfaceGroupId, Date.now())
			}

			const newGroup = new SurfaceGroup(
				this,
				this.#dbTableGroups,
				this.#handlerDependencies.pageStore,
				this.#handlerDependencies.userconfig,
				this.#updateEvents,
				surfaceGroupId,
				!rawSurfaceGroupId ? surfaceHandler : null,
				isLocked
			)
			this.#surfaceGroups.set(surfaceGroupId, newGroup)
			this.emit('group-add', surfaceGroupId)
		}
		this.emit('surface-in-group', surfaceHandler.surfaceId, surfaceGroupId)
	}

	/**
	 * Detach a `SurfaceHandler` from its `SurfaceGroup`
	 */
	#detachSurfaceFromGroup(surfaceHandler: SurfaceHandler): void {
		const existingGroupId = surfaceHandler.getGroupId() || surfaceHandler.surfaceId
		const existingGroup = existingGroupId ? this.#surfaceGroups.get(existingGroupId) : null
		if (!existingGroup) return

		existingGroup.detachSurface(surfaceHandler)
		this.emit('surface-in-group', surfaceHandler.surfaceId, null)

		// Cleanup an auto surface group
		if (existingGroup.isAutoGroup) {
			existingGroup.dispose()
			this.#surfaceGroups.delete(existingGroupId)
			this.emit('group-delete', existingGroupId)
		}
	}

	/**
	 * Get the config object for a surface
	 * @returns Config object, or undefined
	 */
	getDeviceConfig(surfaceId: string): SurfaceConfig | undefined {
		return this.#dbTableSurfaces.get(surfaceId)
	}

	/**
	 * Set the config object for a surface
	 * @returns Already had config
	 */
	setDeviceConfig(surfaceId: string, surfaceConfig: SurfaceConfig | undefined): boolean {
		const exists = !!this.#dbTableSurfaces.get(surfaceId)

		if (surfaceConfig) {
			this.#dbTableSurfaces.set(surfaceId, surfaceConfig)
			this.emit('surface-config', surfaceId, surfaceConfig.config)
		} else {
			this.#dbTableSurfaces.delete(surfaceId)
			this.emit('surface-config', surfaceId, null)
		}

		return exists
	}

	getDevicesList(): ClientDevicesListItem[] {
		const translateSurfaceConfig = (
			id: string,
			config: SurfaceConfig,
			surfaceHandler: SurfaceHandler | null
		): ClientSurfaceItem => {
			const surfaceInfo: ClientSurfaceItem = {
				id: id,
				type: config?.type || 'Unknown',
				integrationType: config?.integrationType || '',
				name: config?.name || '',
				// location: 'Offline',
				configFields: [],
				isConnected: !!surfaceHandler,
				displayName: getSurfaceName(config, id),
				location: null,
				locked: false,
				enabled: config?.enabled !== false, // Default to true if not specified
				canChangeEnabled: !surfaceHandler?.panel.info.isRemote,
				hasFirmwareUpdates: null,

				size: config.gridSize || null,
				rotation: config?.config?.rotation,
				offset: { columns: config?.config?.xOffset ?? 0, rows: config?.config?.yOffset ?? 0 },
			}

			if (surfaceHandler) {
				let location = surfaceHandler.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				// Satellite-connected surfaces cannot be disabled
				if (location && config?.integrationType === 'satellite') surfaceInfo.canChangeEnabled = false

				surfaceInfo.location = location || null
				surfaceInfo.configFields = surfaceHandler.panel.info.configFields || []
				surfaceInfo.locked = surfaceHandler.isLocked
				surfaceInfo.hasFirmwareUpdates = surfaceHandler.panel.info.hasFirmwareUpdates || null
			}

			return surfaceInfo
		}

		const result: ClientDevicesListItem[] = []

		const surfaceGroups = this.#surfaceGroups
			.values()
			.toArray()
			.sort((a, b) => {
				// manual groups must be first
				if (!a.isAutoGroup && b.isAutoGroup) {
					return -1
				} else if (!b.isAutoGroup && a.isAutoGroup) {
					return 1
				}

				const aIsEmulator = a.groupId.startsWith('emulator:')
				const bIsEmulator = b.groupId.startsWith('emulator:')

				// emulator must be first
				if (aIsEmulator && !bIsEmulator) {
					return -1
				} else if (bIsEmulator && !aIsEmulator) {
					return 1
				}

				// then by id
				return a.groupId.localeCompare(b.groupId)
			})

		const groupsMap = new Map<string, ClientDevicesListItem>()
		let groupIndexSkippedCount = 0
		surfaceGroups.forEach((group, index) => {
			const surfaces = group.surfaceHandlers.map((handler) =>
				translateSurfaceConfig(handler.surfaceId, handler.getFullConfig(), handler)
			)

			// Check if this is an auto group with no controls, and shouldnt be assigned an 'index'
			const skipThisGroupIndex =
				group.isAutoGroup && surfaces.every((s) => s.size && s.size.rows === 0 && s.size.columns === 0)
			if (skipThisGroupIndex) groupIndexSkippedCount++

			const groupResult: ClientDevicesListItem = {
				id: group.groupId,
				index: !skipThisGroupIndex ? index - groupIndexSkippedCount : null,
				displayName: group.displayName,
				isAutoGroup: group.isAutoGroup,
				surfaces,
			}
			result.push(groupResult)
			groupsMap.set(group.groupId, groupResult)
		})

		const mappedSurfaceId = new Set<string>()
		for (const group of result) {
			for (const surface of group.surfaces) {
				mappedSurfaceId.add(surface.id)
			}
		}

		// Add any automatic groups for offline surfaces
		const config = this.#dbTableSurfaces.all()
		for (const [surfaceId, surface] of Object.entries(config)) {
			if (mappedSurfaceId.has(surfaceId)) continue

			const groupId = surface.groupId || surfaceId

			const existingGroup = groupsMap.get(groupId)
			if (existingGroup) {
				existingGroup.surfaces.push(translateSurfaceConfig(surfaceId, surface, null))
			} else {
				const groupResult: ClientDevicesListItem = {
					id: groupId,
					index: null,
					displayName: `${surface.name || surface.type} (${surfaceId}) - Offline`,
					isAutoGroup: true,
					surfaces: [translateSurfaceConfig(surfaceId, surface, null)],
				}
				result.push(groupResult)
				groupsMap.set(groupId, groupResult)
			}
		}

		return result
	}

	async reset(): Promise<void> {
		// Each active handler will re-add itself when doing the save as part of its own reset
		this.#dbTableGroups.clear()
		this.#dbTableSurfaces.clear()
		this.#outboundController.reset()

		// Wait for the surfaces to disconnect before clearing their config
		await new Promise((resolve) => setTimeout(resolve, 500))

		this.#resetAllDevices()
		this.triggerUpdateDevicesList()
	}

	triggerUpdateDevicesList = debounceFn(() => this.#updateDevicesList(), {
		before: false,
		after: true,
		wait: 50,
		maxWait: 200,
	})

	#updateDevicesList(): void {
		const newJsonArr = structuredClone(this.getDevicesList())

		if (this.#updateEvents.listenerCount('emulatorList') > 0) {
			this.#updateEvents.emit('emulatorList', this.#compileEmulatorList())
		}

		const hasSubscribers = this.#updateEvents.listenerCount('surfaces') > 0

		const newJson: Record<string, ClientDevicesListItem> = {}
		for (const surface of newJsonArr) {
			newJson[surface.id] = surface
		}

		if (hasSubscribers) {
			const changes: SurfacesUpdate[] = []

			for (const [id, info] of Object.entries(newJson)) {
				if (!info) continue

				const lastInfo = this.#lastSentJson?.[id]
				if (!lastInfo) {
					changes.push({
						type: 'add',
						itemId: id,
						info,
					})
				} else {
					const patch = jsonPatch.compare(lastInfo, info)
					if (patch.length > 0) {
						changes.push({
							type: 'update',
							itemId: id,
							patch,
						})
					}
				}
			}

			if (this.#lastSentJson) {
				for (const [oldId, oldInfo] of Object.entries(this.#lastSentJson)) {
					if (!oldInfo) continue

					if (!newJson[oldId]) {
						changes.push({
							type: 'remove',
							itemId: oldId,
						})
					}
				}
			}

			if (changes.length > 0) {
				this.#updateEvents.emit('surfaces', changes)
			}
		}
		this.#lastSentJson = newJson
	}

	/**
	 * Register a handler for surface scanning.
	 * @param instanceId - Unique identifier for the handler (typically the instance ID)
	 * @param handler - The handler to register
	 */
	registerSurfaceScanHandler(instanceId: string, handler: SurfaceScanHandler): void {
		this.#surfaceScanHandlers.set(instanceId, handler)
		this.#logger.debug(`Registered surface scan handler for instance: ${instanceId}`)
	}

	/**
	 * Clean up all surface-related state for an instance.
	 * This unregisters the HID scan handler, unloads all surfaces, and forgets discovered surfaces.
	 * @param instanceId - The instance ID to clean up
	 */
	cleanupForInstance(instanceId: string): void {
		// Unregister HID scan handler
		this.#surfaceScanHandlers.delete(instanceId)

		// Unload all surfaces for this instance
		for (const [id, surface] of this.#surfaceHandlers.entries()) {
			if (surface?.panel.instanceId === instanceId) {
				this.removeDevice(id)
			}
		}

		// Forget all discovered surfaces for this instance
		const prefix = `${instanceId}:`
		for (const prefixedDevicePath of this.#discoveredSurfaces) {
			if (prefixedDevicePath.startsWith(prefix)) {
				this.#discoveredSurfaces.delete(prefixedDevicePath)
			}
		}

		// Clear all cached info for this instance from the generator
		this.#discoveredSurfaceRegistry.forgetInstance(instanceId)

		this.#logger.debug(`Cleaned up surfaces for instance: ${instanceId}`)
	}

	async #refreshDevices(): Promise<string | undefined> {
		// Set #pendingScan so generateDiscoveredSurfaceId can wait for us
		const { promise, resolve } = Promise.withResolvers<void>()
		this.#runningScan = promise

		try {
			return await this.#doRefreshDevices()
		} finally {
			this.#runningScan = null
			resolve()
		}
	}

	async #doRefreshDevices(): Promise<string | undefined> {
		this.#logger.silly('USB: checking devices')

		try {
			await Promise.allSettled([
				HID.devicesAsync().then(async (deviceInfos) => {
					const sanitisedDevices: HIDDevice[] = []
					for (const deviceInfo of deviceInfos) {
						if (!deviceInfo.path) continue
						sanitisedDevices.push({
							vendorId: deviceInfo.vendorId,
							productId: deviceInfo.productId,
							path: deviceInfo.path,
							serialNumber:
								deviceInfo.serialNumber ||
								createHash('sha1').update(`${deviceInfo.vendorId}:${deviceInfo.productId}`).digest('hex').slice(0, 20),
							manufacturer: deviceInfo.manufacturer,
							product: deviceInfo.product,
							release: deviceInfo.release,
							interface: deviceInfo.interface,
							usagePage: deviceInfo.usagePage,
							usage: deviceInfo.usage,
						} satisfies Complete<HIDDevice>)
					}

					// Collect discovered surfaces from all handlers
					const discoveryPromises: Promise<{
						instanceId: string
						handler: SurfaceScanHandler
						surfaces: DiscoveredSurfaceInfo[]
					}>[] = []

					for (const [instanceId, handler] of this.#surfaceScanHandlers.entries()) {
						discoveryPromises.push(
							handler
								.scanForSurfaces(sanitisedDevices)
								.then((surfaces) => ({ instanceId, handler, surfaces }))
								.catch((e) => {
									this.#logger.warn(`Error during HID scan: ${e}`)
									return { instanceId, handler, surfaces: [] }
								})
						)
					}

					// Wait for all handlers to complete discovery
					const results = await Promise.all(discoveryPromises)

					// Collect all discovered surfaces with their handlers
					const allDiscovered: Array<{
						instanceId: string
						handler: SurfaceScanHandler
						surface: DiscoveredSurfaceInfo
					}> = []
					for (const { instanceId, handler, surfaces } of results) {
						for (const surface of surfaces) {
							allDiscovered.push({ instanceId, handler, surface })
						}
					}

					// Collect all device paths that should not be pruned from the generator cache
					// This includes both HID scan paths and discovered surface paths from module detection
					// Device paths are prefixed with instanceId to ensure global uniqueness
					const devicePathsToKeep = new Set(this.#discoveredSurfaces)
					for (const { instanceId, surface } of allDiscovered) {
						const devicePath = surface.hidDevice?.path ?? surface.scannedDeviceInfo?.devicePath
						if (devicePath) devicePathsToKeep.add(`${instanceId}:${devicePath}`)
					}
					this.#discoveredSurfaceRegistry.prepareForScan(devicePathsToKeep)

					// Open discovered surfaces with collision-resolved IDs
					for (const { instanceId, handler, surface } of allDiscovered) {
						// Generate collision-resolved surface ID
						// Use HID path as the unique key if available, otherwise use scanned device path
						const devicePath = surface.hidDevice?.path ?? surface.scannedDeviceInfo?.devicePath
						if (!devicePath) {
							this.#logger.warn(`Discovered surface ${surface.surfaceId} has no device path, skipping`)
							continue
						}
						// Prefix device path with instanceId to ensure global uniqueness
						const prefixedDevicePath = `${instanceId}:${devicePath}` as const
						// Generate ID and cache opener info in the generator
						const resolvedSurfaceId = this.#discoveredSurfaceRegistry.trackSurface(surface, prefixedDevicePath, handler)

						// Check if it should be opened (respecting per-surface enabled and global auto_enable)
						if (!this.#shouldOpenSurface(resolvedSurfaceId, true)) {
							// Surface should not be opened - ensure a disabled entry exists in DB for later acceptance
							this.#ensureDisabledSurfaceEntry(resolvedSurfaceId, surface.description)
							continue
						}

						// Open the surface with the resolved ID
						handler.openDiscoveredSurface(surface, resolvedSurfaceId).catch((e) => {
							this.#logger.warn(`Error opening discovered surface ${resolvedSurfaceId}: ${e}`)
						})
					}
				}),
			])

			this.#logger.silly('USB: done')

			return undefined
		} catch (e) {
			this.#logger.silly('USB: scan failed ' + e)
			return 'Scan failed'
		}
	}

	/**
	 * Add a satellite device
	 */
	addSatelliteDevice(deviceInfo: SatelliteDeviceInfo): SurfaceIPSatellite {
		this.removeDevice(deviceInfo.deviceId)

		const device = new SurfaceIPSatellite(deviceInfo, this.surfaceExecuteExpression.bind(this))

		this.#createSurfaceHandler(deviceInfo.deviceId, 'satellite', device)

		this.triggerUpdateDevicesList()

		return device
	}

	/**
	 * Add a new plugin panel
	 */
	addPluginPanel(moduleId: string, panel: SurfacePluginPanel): void {
		this.removeDevice(panel.info.surfaceId)

		this.#createSurfaceHandler(panel.info.surfaceId, moduleId, panel)

		this.triggerUpdateDevicesList()
	}

	/**
	 * Add the elgato plugin connection
	 */
	addElgatoPluginDevice(surfaceId: string, socket: ServiceElgatoPluginSocket): SurfaceIPElgatoPlugin {
		this.removeDevice(surfaceId)

		const device = new SurfaceIPElgatoPlugin(
			this.#handlerDependencies.controls,
			this.#handlerDependencies.pageStore,
			surfaceId,
			socket
		)

		this.#createSurfaceHandler(surfaceId, 'elgato-plugin', device)

		this.triggerUpdateDevicesList()

		return device
	}

	surfaceExecuteExpression(
		str: string,
		surfaceId: string,
		injectedVariableValues: VariableValues | undefined
	): ExecuteExpressionResult {
		const parser = this.#handlerDependencies.variables.values.createVariablesAndExpressionParser(null, null, {
			...injectedVariableValues,
			...this.#getInjectedVariablesForSurfaceId(surfaceId),
		})

		return parser.executeExpression(str, undefined)
	}

	/**
	 * Variables to inject based on location
	 */
	#getInjectedVariablesForSurfaceId(surfaceId: string): VariableValues {
		const pageNumber = this.devicePageGet(surfaceId)

		return {
			'$(this:surface_id)': surfaceId,

			// Reactivity is triggered manually
			'$(this:page)': pageNumber,

			// Reactivity happens for these because of references to the inner variables
			'$(this:page_name)': pageNumber ? `$(internal:page_number_${pageNumber}_name)` : VARIABLE_UNKNOWN_VALUE,
		}
	}

	exportAll(): Record<number, SurfaceConfig> {
		return this.#dbTableSurfaces.all()
	}

	exportAllGroups(): Record<number, SurfaceGroupConfig> {
		return this.#dbTableGroups.all()
	}

	exportAllRemote(): Record<string, OutboundSurfaceInfo> {
		return this.#outboundController.exportAll()
	}

	/**
	 * Import a surface configuration
	 */
	importSurfaces(surfaceGroups: Record<string, any>, surfaces: Record<string, any>): void {
		for (const [id, surfaceGroup] of Object.entries(surfaceGroups)) {
			let group = this.#getGroupForId(id, true)
			if (!group) {
				// Group does not exist
				group = new SurfaceGroup(
					this,
					this.#dbTableGroups,
					this.#handlerDependencies.pageStore,
					this.#handlerDependencies.userconfig,
					this.#updateEvents,
					id,
					null,
					this.isPinLockEnabled()
				)
				this.#surfaceGroups.set(id, group)
			}

			// Sync config
			group.setName(surfaceGroup.name ?? '')
			for (const [key, value] of Object.entries(surfaceGroup)) {
				if (key === 'name') continue
				group.setGroupConfigValue(key, value as JsonValue)
			}
			group.clearPageHistory()
		}

		for (const [surfaceId, surfaceConfig] of Object.entries(surfaces)) {
			const surface = this.#getSurfaceHandlerForId(surfaceId, true)
			if (surface) {
				// Device is currently loaded
				surface.setPanelConfig(surfaceConfig.config)
				if (surfaceConfig.groupConfig) surface.saveGroupConfig(surfaceConfig.groupConfig)
				surface.setPanelName(surfaceConfig.name)

				// Update the groupId
				const newGroupId = surfaceConfig.groupId ?? null
				if (surface.getGroupId() !== newGroupId && this.#getGroupForId(newGroupId)) {
					this.#detachSurfaceFromGroup(surface)
					surface.setGroupId(newGroupId)
					this.#attachSurfaceToGroup(surface)
				}

				// it appears that #surfaceHandlers and #surfaceGroups have independent copies of `groupConfig`...
				//  and the one in #surfaceGroups is the one that controls the surface's ..page.. values.
				// Note that #surfaceGroups includes both user-defined groups and surfaces that are not in groups (aka Auto Groups)
				const group = this.#surfaceGroups.get(surfaceId)
				// now copy the surfaceGroup into #surfaceGroups
				// it appears that `surfaceHandlers` is empty if a surface is in a user-specified group
				//  (note: I tried moving `&& group.surfaceHandlers.length > 0` to `group.#isAutoGroup` in Group.ts,
				//  but it resulted in bogus groups being created when a device was attached -- and these groups only show up on next restart or on export.)
				if (group && group.surfaceHandlers.length > 0) {
					group.setName(surfaceConfig.groupConfig?.name ?? '')
					for (const [key, value] of Object.entries(surfaceConfig.groupConfig)) {
						if (key === 'name') continue
						group.setGroupConfigValue(key, value as JsonValue)
					}
					group.clearPageHistory()
				}
			} else {
				// Device is not loaded
				this.setDeviceConfig(surfaceId, surfaceConfig)

				if (surfaceId.startsWith('emulator:')) {
					this.addEmulator(surfaceId.substring(9), undefined)

					if (surfaceConfig.groupConfig) {
						// need the following to put the emulator on the "current" page, to match its export state
						const group = this.#surfaceGroups.get(surfaceId)
						group?.setGroupConfigValue('last_page_id', surfaceConfig.groupConfig.last_page_id)
						group?.clearPageHistory()
					}
				}
			}
		}

		this.triggerUpdateDevicesList()
	}

	/**
	 * Reserve a surface ID for opening.
	 * This prevents race conditions if two instances try to open the same surface at once.
	 * If the surface is already open, or already reserved, this will return null.
	 * @returns A function to clear the reservation, or null if it could not be reserved
	 */
	reserveSurfaceForOpening(surfaceId: string, respectEnabled: boolean): (() => void) | null {
		if (!this.#shouldOpenSurface(surfaceId, respectEnabled)) return null

		// Reserve it
		this.#surfaceHandlers.set(surfaceId, null)

		return () => {
			// Clear the reservation
			if (this.#surfaceHandlers.get(surfaceId) === null) {
				this.#surfaceHandlers.delete(surfaceId)
			}
		}
	}

	/**
	 * Generate a collision-resolved surface ID for a discovered surface.
	 * Waits for any pending scan to complete first to avoid race conditions.
	 * @param instance - The instance/opener responsible for this surface
	 * @param info - Information about the discovered surface
	 * @param respectEnabled - Whether to respect the per-surface enabled setting. Set to false for self-discovering surfaces that cannot reliably abort the open process.
	 * @returns The collision-resolved surface ID, and whether the surface should be opened
	 */
	async generateDiscoveredSurfaceId(
		instance: SurfaceOpener,
		info: CheckDeviceInfo,
		respectEnabled: boolean
	): Promise<{ resolvedSurfaceId: string; shouldOpen: boolean }> {
		// Wait for any pending scan to complete
		if (this.#runningScan) await this.#runningScan

		// Prefix device path with instanceId to ensure global uniqueness
		const prefixedDevicePath = `${instance.instanceId}:${info.devicePath}` as const

		const discoveredSurface: DiscoveredSurfaceInfo = {
			surfaceId: info.surfaceId,
			surfaceIdIsNotUnique: info.surfaceIdIsNotUnique,
			description: info.description,
			hidDevice: undefined,
			scannedDeviceInfo: info,
		}

		// Generate a new collision-resolved ID
		const resolvedSurfaceId = this.#discoveredSurfaceRegistry.trackSurface(
			discoveredSurface,
			prefixedDevicePath,
			instance
		)

		// Track this discovered surface with its owning instance
		this.#discoveredSurfaces.add(prefixedDevicePath)

		// Determine if the surface should be opened (respecting per-surface enabled and global auto_enable)
		const shouldOpen = this.#shouldOpenSurface(resolvedSurfaceId, respectEnabled)

		// If not opening due to enabled settings, ensure a disabled entry exists in DB
		if (!shouldOpen && !this.#surfaceHandlers.has(resolvedSurfaceId)) {
			this.#ensureDisabledSurfaceEntry(resolvedSurfaceId, info.description)
		}

		return { resolvedSurfaceId, shouldOpen }
	}

	/**
	 * Check if a surface with the given resolved ID should be opened.
	 * @param resolvedSurfaceId - The collision-resolved surface ID
	 * @param respectEnabled - Whether to respect the per-surface enabled setting and global auto_enable_discovered_surfaces.
	 * @returns Whether the surface should be opened
	 */
	#shouldOpenSurface(resolvedSurfaceId: string, respectEnabled: boolean): boolean {
		// Already opened or reserved, don't open again
		if (this.#surfaceHandlers.has(resolvedSurfaceId)) return false

		// Check the per-surface enabled setting and global auto_enable_discovered_surfaces
		if (respectEnabled) {
			const existingConfig = this.getDeviceConfig(resolvedSurfaceId)
			if (existingConfig) {
				// Surface has an existing config - check if it's enabled (default to true if not specified)
				if (existingConfig.enabled === false) {
					return false
				}
			} else {
				// No existing config - check global auto_enable_discovered_surfaces setting
				const autoEnableDiscovered = this.#handlerDependencies.userconfig.getKey('auto_enable_discovered_surfaces')
				if (!autoEnableDiscovered) {
					return false
				}
			}
		}

		return true
	}

	/**
	 * Ensure a disabled surface entry exists in the database.
	 * This is called when a discovered surface is not opened because it's disabled or auto_enable is off.
	 * Creating the entry allows the user to see and enable the surface later via the UI.
	 *
	 * @param surfaceId - The surface ID
	 * @param description - Description/type of the surface
	 */
	#ensureDisabledSurfaceEntry(surfaceId: string, description: string): void {
		const existingConfig = this.getDeviceConfig(surfaceId)
		if (existingConfig) {
			// Config already exists, don't overwrite
			return
		}

		// Create a minimal config entry with enabled=false
		const minimalConfig: SurfaceConfig = {
			config: structuredClone(PanelDefaults),
			groupConfig: structuredClone(SurfaceGroup.DefaultOptions),
			groupId: null,
			enabled: false,
			type: description || 'Unknown',
			integrationType: undefined,
			gridSize: undefined,
		}

		this.setDeviceConfig(surfaceId, minimalConfig)
		this.triggerUpdateDevicesList()
		this.#logger.debug(`Created disabled surface entry for: ${surfaceId}`)
	}

	/**
	 * Forget a discovered surface by its device path.
	 * This removes the surface from the discovered registry and the ID generator.
	 * @param instanceId - The instance ID that owns this surface
	 * @param devicePath - The device path of the surface to forget
	 */
	forgetDiscoveredSurface(instanceId: string, devicePath: string): void {
		const prefixedDevicePath = `${instanceId}:${devicePath}` as const
		if (this.#discoveredSurfaces.delete(prefixedDevicePath)) {
			this.#discoveredSurfaceRegistry.forgetSurface(prefixedDevicePath)
			this.#logger.debug(`Forgot discovered surface: ${prefixedDevicePath}`)
		}
	}

	initInstance(_instanceId: string, features: SurfaceChildFeatures): void {
		if (this.#runningUsbHotplug && (features.supportsHid || features.supportsDetection || features.supportsScan)) {
			this.triggerRefreshDevicesEvent()
		}
	}

	/**
	 * Remove a surface
	 */
	removeDevice(surfaceId: string, purge = false): void {
		const surfaceHandler = this.#surfaceHandlers.get(surfaceId)
		if (surfaceHandler) {
			this.#logger.silly('remove device ' + surfaceId)

			// Release the id from the discovered registry, so that it can be reattached
			this.#discoveredSurfaceRegistry.forgetSurfaceById(surfaceId)

			// Detach surface from any group
			this.#detachSurfaceFromGroup(surfaceHandler)

			try {
				surfaceHandler.unload(purge)
			} catch (_e) {
				// Ignore for now
			}

			surfaceHandler.removeAllListeners()

			this.#surfaceHandlers.delete(surfaceId)
			this.emit('surface-delete', surfaceId)
		}

		this.triggerUpdateDevicesList()
	}

	quit(): void {
		for (const surface of this.#surfaceHandlers.values()) {
			if (!surface) continue
			try {
				surface.unload()
			} catch (_e) {
				// Ignore for now
			}
		}

		this.#outboundController.quit()

		this.#surfaceHandlers.clear()
		this.triggerUpdateDevicesList()
	}

	/**
	 * Find surfaceId by index
	 */
	getDeviceIdFromIndex(index: number): string | undefined {
		for (const group of this.getDevicesList()) {
			if (group.index !== undefined && group.index === index) {
				return group.id
			}
		}
		return undefined
	}

	/**
	 * Perform page-up for a surface
	 */
	devicePageUp(surfaceOrGroupId: string, looseIdMatching = false): void {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageUp()
		}
	}
	/**
	 * Perform page-down for a surface
	 */
	devicePageDown(surfaceOrGroupId: string, looseIdMatching = false): void {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageDown()
		}
	}
	/**
	 * Set the page id for a surface
	 * @param surfaceOrGroupId
	 * @param pageId
	 * @param looseIdMatching
	 * @param defer Defer the drawing to the next tick
	 */
	devicePageSet(surfaceOrGroupId: string, pageId: string, looseIdMatching = false, defer = false): void {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.setCurrentPage(pageId, defer)
		}
	}
	/**
	 * Get the page id of a surface
	 */
	devicePageGet(surfaceOrGroupId: string, looseIdMatching = false): string | undefined {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			return surfaceGroup.getCurrentPageId()
		} else {
			return undefined
		}
	}
	/**
	 * Get the startup page id of a surface
	 */
	devicePageGetStartup(surfaceOrGroupId: string, looseIdMatching = false): string | undefined {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			return surfaceGroup.groupConfig.use_last_page
				? surfaceGroup.groupConfig.last_page_id
				: surfaceGroup.groupConfig.startup_page_id
		} else {
			return undefined
		}
	}

	/**
	 * Get the groupId for a surfaceId (or groupId)
	 */
	getGroupIdFromDeviceId(surfaceOrGroupId: string, looseIdMatching = false): string | undefined {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)

		return surfaceGroup?.groupId
	}

	#resetAllDevices() {
		// Destroy any groups and detach their contents
		for (const surfaceGroup of this.#surfaceGroups.values()) {
			for (const surface of surfaceGroup.surfaceHandlers) {
				surfaceGroup.detachSurface(surface)
			}
			surfaceGroup.dispose()
		}
		this.#surfaceGroups.clear()

		// Re-attach in auto-groups
		for (const [id, surface] of this.#surfaceHandlers.entries()) {
			if (!surface) continue

			try {
				if (id.startsWith('emulator:')) {
					this.removeDevice(id, true)
				} else {
					surface.resetConfig()

					this.#attachSurfaceToGroup(surface)
				}
			} catch (_e) {
				this.#logger.warn('Could not reattach a surface')
			}
		}
	}

	/**
	 * Is pin lock enabled
	 */
	isPinLockEnabled(): boolean {
		return !!this.#handlerDependencies.userconfig.getKey('pin_enable')
	}

	/**
	 * Propagate variable changes
	 */
	onVariablesChanged(allChangedVariables: ReadonlySet<string>): void {
		for (const surface of this.#surfaceHandlers.values()) {
			if (surface?.panel?.onVariablesChanged) {
				surface.panel.onVariablesChanged(allChangedVariables)
			}
		}
	}

	/**
	 * Set the locked state of all surfaces
	 * @param locked
	 * @param forceUnlock Force all surfaces to be unlocked
	 */
	setAllLocked(locked: boolean, forceUnlock = false): void {
		locked = !!locked

		if (forceUnlock) {
			locked = false
		} else {
			if (!this.isPinLockEnabled()) return
		}

		if (!forceUnlock && this.#surfacesAllLocked === locked) {
			// No change
			return
		}

		this.#logger.debug(`Setting lock state of all surfaces to ${locked} (forceUnlock=${forceUnlock})`)
		this.#surfacesAllLocked = locked

		for (const surfaceGroup of this.#surfaceGroups.values()) {
			if (locked) {
				this.#surfacesLastInteraction.delete(surfaceGroup.groupId)
			} else {
				this.#surfacesLastInteraction.set(surfaceGroup.groupId, Date.now())
			}

			surfaceGroup.setLocked(!!locked)
		}
	}

	/**
	 * Set all surfaces as locked
	 */
	setSurfaceOrGroupLocked(surfaceOrGroupId: string, locked: boolean, looseIdMatching = false): void {
		if (!this.isPinLockEnabled()) return

		if (this.#handlerDependencies.userconfig.getKey('link_lockouts')) {
			this.setAllLocked(locked)
		} else {
			this.#surfacesAllLocked = false

			let resolvedGroupId = surfaceOrGroupId

			// Perform the lock/unlock if connected
			const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
			if (surfaceGroup) {
				resolvedGroupId = surfaceGroup.groupId

				const changed = surfaceGroup.setLocked(!!locked)
				if (changed) {
					this.#logger.debug(`Setting lock state of ${surfaceOrGroupId} to ${locked}`)
				}
			}

			// Track the lock/unlock state, even if the device isn't online
			if (locked) {
				this.#surfacesLastInteraction.delete(resolvedGroupId)
			} else {
				this.#surfacesLastInteraction.set(resolvedGroupId, Date.now())
			}
		}
	}

	/**
	 * Set the brightness of a surface
	 * @param surfaceId
	 * @param brightness 0-100
	 * @param looseIdMatching
	 */
	setDeviceBrightness(surfaceId: string, brightness: number, looseIdMatching = false): void {
		const device = this.#getSurfaceHandlerForId(surfaceId, looseIdMatching)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	/**
	 * Set the position offset of a surface
	 * @param surfaceId
	 * @param xOffset
	 * @param yOffset
	 * @param looseIdMatching
	 */
	setDevicePosition(surfaceId: string, xOffset: number, yOffset: number, looseIdMatching = false): void {
		const device = this.#getSurfaceHandlerForId(surfaceId, looseIdMatching)
		if (device) {
			device.setPosition(xOffset, yOffset)
		}
	}

	/**
	 * Adjust the position offset of a surface by a relative amount
	 * @param surfaceId
	 * @param xAdjustment
	 * @param yAdjustment
	 * @param looseIdMatching
	 */
	adjustDevicePosition(surfaceId: string, xAdjustment: number, yAdjustment: number, looseIdMatching = false): void {
		const device = this.#getSurfaceHandlerForId(surfaceId, looseIdMatching)
		if (device) {
			device.adjustPosition(xAdjustment, yAdjustment)
		}
	}

	/**
	 * Get the number of surface groups, excluding the auto groups
	 */
	getGroupCount(): number {
		let count = 0
		for (const group of this.#surfaceGroups.values()) {
			if (!group.isAutoGroup) {
				count++
			}
		}
		return count
	}

	/**
	 * Get the `SurfaceGroup` for a surfaceId or groupId
	 */
	#getGroupForId(surfaceOrGroupId: string, looseIdMatching = false): SurfaceGroup | undefined {
		const matchingGroup = this.#surfaceGroups.get(surfaceOrGroupId)
		if (matchingGroup) return matchingGroup

		const surface = this.#getSurfaceHandlerForId(surfaceOrGroupId, looseIdMatching)
		if (surface) {
			const groupId = surface.getGroupId() || surface.surfaceId
			return this.#surfaceGroups.get(groupId)
		}

		return undefined
	}

	/**
	 * Get the `SurfaceHandler` for a surfaceId
	 * @param surfaceId
	 * @param looseIdMatching Loosely match the id, to handle old device naming
	 */
	#getSurfaceHandlerForId(surfaceId: string, looseIdMatching: boolean): SurfaceHandler | undefined {
		if (surfaceId === 'emulator') surfaceId = 'emulator:emulator'

		const surfaces = this.#surfaceHandlers.values().toArray()

		// try and find exact match
		let surface = surfaces.find((d) => d && d.surfaceId === surfaceId)
		if (surface) return surface

		// only try more variations if the id isnt new format
		if (!looseIdMatching || surfaceId.includes(':')) return undefined

		// try the most likely streamdeck prefix
		let surfaceId2 = `streamdeck:${surfaceId}`
		surface = surfaces.find((d) => d && d.surfaceId === surfaceId2)
		if (surface) return surface

		// it is unlikely, but it could be a loupedeck
		surfaceId2 = `loupedeck:${surfaceId}`
		surface = surfaces.find((d) => d && d.surfaceId === surfaceId2)
		if (surface) return surface

		// or maybe a satellite?
		surfaceId2 = `satellite-${surfaceId}`
		return surfaces.find((d) => d && d.surfaceId === surfaceId2) || undefined
	}
}

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

import findProcess from 'find-process'
import HID from 'node-hid'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import pDebounce from 'p-debounce'
import { getStreamDeckDeviceInfo } from '@elgato-stream-deck/node'
import { getBlackmagicControllerDeviceInfo } from '@blackmagic-controller/node'
import { usb } from 'usb'
import { isAShuttleDevice } from 'shuttle-node'
import { listLoupedecks } from '@loupedeck/node'
import { SurfaceHandler, getSurfaceName } from './Handler.js'
import { SurfaceIPElgatoEmulator, EmulatorRoom } from './IP/ElgatoEmulator.js'
import { SurfaceIPElgatoPlugin } from './IP/ElgatoPlugin.js'
import { SurfaceIPSatellite, SatelliteDeviceInfo } from './IP/Satellite.js'
import { SurfaceUSBElgatoStreamDeck } from './USB/ElgatoStreamDeck.js'
import { SurfaceUSBInfinitton } from './USB/Infinitton.js'
import { SurfaceUSBXKeys } from './USB/XKeys.js'
import { SurfaceUSBLoupedeck } from './USB/Loupedeck.js'
import { SurfaceUSBContourShuttle } from './USB/ContourShuttle.js'
import { isVecFootpedal, SurfaceUSBVECFootpedal } from './USB/VECFootpedal.js'
import { SurfaceIPVideohubPanel, VideohubPanelDeviceInfo } from './IP/VideohubPanel.js'
import { SurfaceUSBFrameworkMacropad } from './USB/FrameworkMacropad.js'
import { SurfaceUSB203SystemsMystrix } from './USB/203SystemsMystrix.js'
import { SurfaceUSBMiraboxStreamDock } from './USB/MiraboxStreamDock.js'
import { SurfaceGroup, validateGroupConfigValue } from './Group.js'
import { SurfaceOutboundController } from './Outbound.js'
import { SurfaceUSBBlackmagicController } from './USB/BlackmagicController.js'
import { VARIABLE_UNKNOWN_VALUE } from '../Variables/Util.js'
import type {
	ClientDevicesListItem,
	ClientSurfaceItem,
	SurfaceConfig,
	SurfaceGroupConfig,
	SurfacePanelConfig,
	SurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { StreamDeckTcp } from '@elgato-stream-deck/tcp'
import type { ServiceElgatoPluginSocket } from '../Service/ElgatoPlugin.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type {
	LocalUSBDeviceOptions,
	SurfaceHandlerDependencies,
	SurfacePanel,
	SurfacePanelFactory,
	UpdateEvents,
} from './Types.js'
import { createOrSanitizeSurfaceHandlerConfig } from './Config.js'
import { EventEmitter } from 'events'
import LogController from '../Log/Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import { SurfaceFirmwareUpdateCheck } from './FirmwareUpdateCheck.js'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { getMXCreativeConsoleDeviceInfo } from '@logitech-mx-creative-console/node'
import { SurfaceUSBLogiMXConsole } from './USB/LogiMXCreativeConsole.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import type { EmulatorListItem, EmulatorPageConfig } from '@companion-app/shared/Model/Emulator.js'

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')
HID.devices()

export interface SurfaceControllerEvents {
	surface_name: [surfaceId: string, name: string]
	surface_page: [surfaceId: string, pageId: string]
	surface_locked: [surfaceId: string, locked: boolean]
	'surface-add': [surfaceId: string]
	'surface-delete': [surfaceId: string]

	'surface-in-group': [surfaceId: string, groupId: string | null]

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
	 * Whether a usb scan is currently in progress
	 */
	#runningRefreshDevices: boolean = false

	readonly #outboundController: SurfaceOutboundController

	readonly #firmwareUpdates: SurfaceFirmwareUpdateCheck

	constructor(db: DataDatabase, handlerDependencies: SurfaceHandlerDependencies) {
		super()

		this.#dbTableSurfaces = db.getTableView('surfaces')
		this.#dbTableGroups = db.getTableView('surface_groups')
		this.#handlerDependencies = handlerDependencies

		this.#updateEvents.setMaxListeners(0)

		this.#outboundController = new SurfaceOutboundController(this, db)
		this.#firmwareUpdates = new SurfaceFirmwareUpdateCheck(this.#surfaceHandlers, () => this.updateDevicesList())

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
					this.addEmulator(id.substring(9), undefined, true)
				}
			}

			// Initial search for USB devices
			this.#refreshDevices().catch(() => {
				this.#logger.warn('Initial USB scan failed')
			})
			this.#outboundController.init()

			this.updateDevicesList()

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
	 * Trigger a rescan of connected devices
	 */
	triggerRefreshDevices = pDebounce(async () => this.#refreshDevices(), 50, {
		before: false,
	})

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
	 * @param skipUpdate Skip emitting an update to the devices list
	 */
	addEmulator(id: string, name: string | undefined, skipUpdate = false): SurfaceHandler {
		const fullId = EmulatorRoom(id)
		if (this.#surfaceHandlers.has(fullId)) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		const handler = this.#createSurfaceHandler(fullId, 'emulator', new SurfaceIPElgatoEmulator(this.#updateEvents, id))
		if (name !== undefined) handler.setPanelName(name)

		if (!skipUpdate) this.updateDevicesList()

		return handler
	}

	/**
	 * Create a `SurfaceHandler` for a `SurfacePanel`
	 */
	#createSurfaceHandler(surfaceId: string, integrationType: string, panel: SurfacePanel): SurfaceHandler {
		const existingSurfaceConfig = this.getDeviceConfig(panel.info.deviceId)
		if (!existingSurfaceConfig) {
			this.#logger.silly(`Creating config for newly discovered device ${panel.info.deviceId}`)
		} else {
			this.#logger.silly(`Reusing config for device ${panel.info.deviceId}`)
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

		// Perform an update check in the background
		this.#firmwareUpdates.triggerCheckSurfaceForUpdates(handler)

		return handler
	}

	createTrpcRouter() {
		const self = this
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
					const changes = toIterable(self.#updateEvents, `surfaceConfig:${input.surfaceId}`, signal)

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

					for await (const [change] of changes) {
						yield change
					}
				}),

			rescanUsb: publicProcedure.mutation(async () => {
				try {
					return this.triggerRefreshDevices()
				} catch (e: any) {
					return e.message
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

					this.updateDevicesList()

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

					this.updateDevicesList()
				}),

			groupSetConfigKey: publicProcedure
				.input(
					z.object({
						groupId: z.string(),
						key: z.string(),
						value: z.any(),
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
						} catch (e: any) {
							throw new Error(`Failed to update value: ${e?.message ?? e}`)
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
					const surfaceHandler = Array.from(this.#surfaceHandlers.values()).find(
						(surface) => surface && surface.surfaceId === input.surfaceId
					)
					if (surfaceHandler) {
						this.#detachSurfaceFromGroup(surfaceHandler)

						surfaceHandler.setGroupId(input.groupId)

						this.#attachSurfaceToGroup(surfaceHandler)

						this.updateDevicesList()
						return
					}

					// Surface not found, perhaps it is an offline surface?
					const surfaceConfig = this.#dbTableSurfaces.get(input.surfaceId)
					if (surfaceConfig) {
						surfaceConfig.groupId = input.groupId
						this.#dbTableSurfaces.set(input.surfaceId, surfaceConfig)

						this.updateDevicesList()
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
						this.updateDevicesList()

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
						this.updateDevicesList()
						return
					}

					// Find a connected surface
					for (const surface of this.#surfaceHandlers.values()) {
						if (surface && surface.surfaceId == input.surfaceOrGroupId) {
							surface.setPanelName(input.name)
							this.updateDevicesList()
							return
						}
					}

					// Find a disconnected surface
					const surfaceConfig = this.#dbTableSurfaces.get(input.surfaceOrGroupId)
					if (surfaceConfig) {
						surfaceConfig.name = input.name
						this.#dbTableSurfaces.set(input.surfaceOrGroupId, surfaceConfig)
						this.updateDevicesList()
						return
					}

					throw new Error('not found')
				}),

			surfaceSetConfigKey: publicProcedure
				.input(
					z.object({
						surfaceId: z.string(),
						key: z.string(),
						value: z.any(),
					})
				)
				.mutation(async ({ input }) => {
					for (const surface of this.#surfaceHandlers.values()) {
						if (surface && surface.surfaceId == input.surfaceId) {
							surface.setPanelConfig({
								...surface.getPanelConfig(),
								[input.key]: input.value,
							})

							setImmediate(() => this.updateDevicesList())
						}
					}
					return 'device not found'
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
			this.#updateEvents.emit(`surfaceConfig:${surfaceId}`, surfaceConfig.config)
		} else {
			this.#dbTableSurfaces.delete(surfaceId)
			this.#updateEvents.emit(`surfaceConfig:${surfaceId}`, null)
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
				hasFirmwareUpdates: null,

				size: config.gridSize || null,
				rotation: config?.config?.rotation,
				offset: { columns: config?.config?.xOffset ?? 0, rows: config?.config?.yOffset ?? 0 },
			}

			if (surfaceHandler) {
				let location = surfaceHandler.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				surfaceInfo.location = location || null
				surfaceInfo.configFields = surfaceHandler.panel.info.configFields || []
				surfaceInfo.locked = surfaceHandler.isLocked
				surfaceInfo.hasFirmwareUpdates = surfaceHandler.panel.info.hasFirmwareUpdates || null
			}

			return surfaceInfo
		}

		const result: ClientDevicesListItem[] = []

		const surfaceGroups = Array.from(this.#surfaceGroups.values())
		surfaceGroups.sort((a, b) => {
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
		this.updateDevicesList()
	}

	updateDevicesList(): void {
		const newJsonArr = cloneDeep(this.getDevicesList())

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

	async #refreshDevices(): Promise<string | undefined> {
		// Ensure only one scan is being run at a time
		if (this.#runningRefreshDevices) {
			return this.triggerRefreshDevices()
		}

		try {
			this.#runningRefreshDevices = true

			let streamDeckSoftwareRunning = false
			const streamdeckDisabled = !!this.#handlerDependencies.userconfig.getKey('elgato_plugin_enable')

			try {
				// Make sure we don't try to take over stream deck devices when the stream deck application
				// is running on windows.
				if (!streamdeckDisabled && process.platform === 'win32') {
					const list = await findProcess.default('name', '\\StreamDeck.exe')
					if (typeof list === 'object' && list.length > 0) {
						streamDeckSoftwareRunning = true
						this.#logger.silly('Elgato software detected, ignoring stream decks')
					}
				}
			} catch (_e) {
				// scan for all usb devices anyways
			}

			// Now do the scan
			const scanForLoupedeck = !!this.#handlerDependencies.userconfig.getKey('loupedeck_enable')
			this.#logger.silly('scanForLoupedeck', scanForLoupedeck)
			const ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled
			this.#logger.silly('USB: checking devices')

			try {
				await Promise.allSettled([
					HID.devicesAsync().then(async (deviceInfos) =>
						Promise.allSettled(
							deviceInfos.map(async (deviceInfo) => {
								this.#logger.silly('found device ' + JSON.stringify(deviceInfo))
								if (deviceInfo.path && !this.#surfaceHandlers.has(deviceInfo.path)) {
									if (!ignoreStreamDeck && getStreamDeckDeviceInfo(deviceInfo)) {
										await this.#addDevice(deviceInfo.path, {}, 'elgato-streamdeck', SurfaceUSBElgatoStreamDeck)
										return
									} else if (
										getMXCreativeConsoleDeviceInfo(deviceInfo) &&
										this.#handlerDependencies.userconfig.getKey('logitech_mx_console_enable')
									) {
										await this.#addDevice(deviceInfo.path, {}, 'logi-mx-console', SurfaceUSBLogiMXConsole)
										return
									} else if (
										deviceInfo.vendorId === 0xffff &&
										(deviceInfo.productId === 0x1f40 || deviceInfo.productId === 0x1f41)
									) {
										await this.#addDevice(deviceInfo.path, {}, 'infinitton', SurfaceUSBInfinitton)
									} else if (isAShuttleDevice(deviceInfo)) {
										// Note: this must be before the xkeys, as the pid can clash
										if (this.#handlerDependencies.userconfig.getKey('contour_shuttle_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'contour-shuttle', SurfaceUSBContourShuttle)
										}
									} else if (
										// More specific match has to be above xkeys
										isVecFootpedal(deviceInfo)
									) {
										if (this.#handlerDependencies.userconfig.getKey('vec_footpedal_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'vec-footpedal', SurfaceUSBVECFootpedal)
										}
									} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
										if (this.#handlerDependencies.userconfig.getKey('xkeys_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'xkeys', SurfaceUSBXKeys)
										}
									} else if (
										deviceInfo.vendorId === 0x32ac && // frame.work
										deviceInfo.productId === 0x0013 && // macropod
										deviceInfo.usagePage === 0xffdd && // rawhid interface
										deviceInfo.usage === 0x61
									) {
										await this.#addDevice(deviceInfo.path, {}, 'framework-macropad', SurfaceUSBFrameworkMacropad)
									} else if (
										this.#handlerDependencies.userconfig.getKey('blackmagic_controller_enable') &&
										getBlackmagicControllerDeviceInfo(deviceInfo)
									) {
										await this.#addDevice(deviceInfo.path, {}, 'blackmagic-controller', SurfaceUSBBlackmagicController)
									} else if (
										deviceInfo.vendorId === 0x0203 && // 203 Systems
										(deviceInfo.productId & 0xffc0) == 0x1040 && // Mystrix
										deviceInfo.usagePage === 0xff00 && // rawhid interface
										deviceInfo.usage === 0x01
									) {
										if (this.#handlerDependencies.userconfig.getKey('mystrix_enable')) {
											await this.#addDevice(deviceInfo.path, {}, '203-mystrix', SurfaceUSB203SystemsMystrix)
										}
									} else if (
										(deviceInfo.vendorId === 0x6602 ||
											deviceInfo.vendorId === 0x6603 ||
											deviceInfo.vendorId === 0x5548) && // Mirabox
										(deviceInfo.productId === 0x1001 ||
											deviceInfo.productId === 0x1003 ||
											deviceInfo.productId === 0x1007 ||
											deviceInfo.productId === 0x1005 ||
											deviceInfo.productId === 0x1014 || // Stream Dock HSV 293S
											deviceInfo.productId == 0x6670 || // Mirabox 293S
											deviceInfo.productId === 0x1006) && // Stream Dock N4 or 293V3
										deviceInfo.interface === 0
									) {
										if (this.#handlerDependencies.userconfig.getKey('mirabox_streamdock_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'mirabox-streamdock', SurfaceUSBMiraboxStreamDock)
										}
									}
								}
							})
						)
					),
					scanForLoupedeck
						? listLoupedecks().then(async (deviceInfos) =>
								Promise.allSettled(
									deviceInfos.map(async (deviceInfo) => {
										this.#logger.info('found loupedeck', deviceInfo)
										if (!this.#surfaceHandlers.has(deviceInfo.path)) {
											await this.#addDevice(deviceInfo.path, {}, 'loupedeck', SurfaceUSBLoupedeck, true)
										}
									})
								)
							)
						: Promise.resolve(),
				])

				this.#logger.silly('USB: done')

				if (streamdeckDisabled) {
					return 'Ignoring Stream Decks devices as the plugin has been enabled'
				} else if (ignoreStreamDeck) {
					return 'Ignoring Stream Decks devices as the stream deck app is running'
				} else {
					return undefined
				}
			} catch (e) {
				this.#logger.silly('USB: scan failed ' + e)
				return 'Scan failed'
			}
		} finally {
			this.#runningRefreshDevices = false
		}
	}

	async addStreamdeckTcpDevice(streamdeck: StreamDeckTcp): Promise<SurfaceUSBElgatoStreamDeck> {
		const fakePath = `tcp://${streamdeck.remoteAddress}:${streamdeck.remotePort}`

		this.removeDevice(fakePath)

		const device = await SurfaceUSBElgatoStreamDeck.fromTcp(fakePath, streamdeck)

		this.#createSurfaceHandler(fakePath, 'elgato-streamdeck-tcp', device)

		setImmediate(() => this.updateDevicesList())

		return device
	}

	/**
	 * Add a satellite device
	 */
	addSatelliteDevice(deviceInfo: SatelliteDeviceInfo): SurfaceIPSatellite {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPSatellite(deviceInfo, this.#surfaceExecuteExpression.bind(this))

		this.#createSurfaceHandler(deviceInfo.path, 'satellite', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	/**
	 * Add a new videohub panel
	 */
	addVideohubPanelDevice(deviceInfo: VideohubPanelDeviceInfo): SurfaceIPVideohubPanel {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPVideohubPanel(deviceInfo)

		this.#createSurfaceHandler(deviceInfo.path, 'videohub-panel', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	/**
	 * Add the elgato plugin connection
	 */
	addElgatoPluginDevice(devicePath: string, socket: ServiceElgatoPluginSocket): SurfaceIPElgatoPlugin {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(
			this.#handlerDependencies.controls,
			this.#handlerDependencies.pageStore,
			devicePath,
			socket
		)

		this.#createSurfaceHandler(devicePath, 'elgato-plugin', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	async #addDevice(
		devicePath: string,
		deviceOptions: Omit<LocalUSBDeviceOptions, 'executeExpression'>,
		type: string,
		factory: SurfacePanelFactory,
		skipHidAccessCheck = false
	) {
		this.removeDevice(devicePath)

		this.#logger.silly('add device ' + devicePath)

		if (!skipHidAccessCheck) {
			// Check if we have access to the device
			try {
				const devicetest = new HID.HID(devicePath)
				devicetest.close()
			} catch (_e) {
				this.#logger.error(
					`Found "${type}" device, but no access. Please quit any other applications using the device, and try again.`
				)
				return
			}
		}

		// Define something, so that it is known it is loading
		this.#surfaceHandlers.set(devicePath, null)

		try {
			const dev = await factory.create(devicePath, {
				...deviceOptions,
				executeExpression: this.#surfaceExecuteExpression.bind(this),
			})
			this.#createSurfaceHandler(devicePath, type, dev)

			setImmediate(() => {
				this.updateDevicesList()
			})
		} catch (e) {
			this.#logger.error(`Failed to add "${type}" device: ${e}`)

			// Failed, remove the placeholder
			this.#surfaceHandlers.delete(devicePath)
		}
	}

	#surfaceExecuteExpression(
		str: string,
		surfaceId: string,
		injectedVariableValues: CompanionVariableValues | undefined
	) {
		const parser = this.#handlerDependencies.variables.values.createVariablesAndExpressionParser(null, null, {
			...injectedVariableValues,
			...this.#getInjectedVariablesForSurfaceId(surfaceId),
		})

		return parser.executeExpression(str, undefined)
	}

	/**
	 * Variables to inject based on location
	 */
	#getInjectedVariablesForSurfaceId(surfaceId: string): CompanionVariableValues {
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
				group.setGroupConfigValue(key, value)
			}
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
						group.setGroupConfigValue(key, value)
					}
				}
			} else {
				// Device is not loaded
				this.setDeviceConfig(surfaceId, surfaceConfig)

				if (surfaceId.startsWith('emulator:')) {
					this.addEmulator(surfaceId.substring(9), undefined, true)

					if (surfaceConfig.groupConfig) {
						// need the following to put the emulator on the "current" page, to match its export state
						const group = this.#surfaceGroups.get(surfaceId)
						group?.setGroupConfigValue('last_page_id', surfaceConfig.groupConfig.last_page_id)
					}
				}
			}
		}

		this.updateDevicesList()
	}

	/**
	 * Remove a surface
	 */
	removeDevice(devicePath: string, purge = false): void {
		const surfaceHandler = this.#surfaceHandlers.get(devicePath)
		if (surfaceHandler) {
			this.#logger.silly('remove device ' + devicePath)

			const surfaceId = surfaceHandler.surfaceId

			// Detach surface from any group
			this.#detachSurfaceFromGroup(surfaceHandler)

			try {
				surfaceHandler.unload(purge)
			} catch (_e) {
				// Ignore for now
			}

			surfaceHandler.removeAllListeners()

			this.#surfaceHandlers.delete(devicePath)
			this.emit('surface-delete', surfaceId)
		}

		this.updateDevicesList()
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
		this.updateDevicesList()
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
	onVariablesChanged(allChangedVariables: Set<string>): void {
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
		if (forceUnlock) {
			locked = false
		} else {
			if (!this.isPinLockEnabled()) return
		}

		this.#surfacesAllLocked = !!locked

		for (const surfaceGroup of this.#surfaceGroups.values()) {
			this.#surfacesLastInteraction.set(surfaceGroup.groupId, Date.now())

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

			// Track the lock/unlock state, even if the device isn't online
			if (locked) {
				this.#surfacesLastInteraction.delete(surfaceOrGroupId)
			} else {
				this.#surfacesLastInteraction.set(surfaceOrGroupId, Date.now())
			}

			const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
			if (surfaceGroup) {
				surfaceGroup.setLocked(!!locked)
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

		const surfaces = Array.from(this.#surfaceHandlers.values())

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

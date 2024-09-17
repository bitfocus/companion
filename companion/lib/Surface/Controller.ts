// @ts-check
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

import findProcess from 'find-process'
import HID from 'node-hid'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import pDebounce from 'p-debounce'
import { getStreamDeckDeviceInfo } from '@elgato-stream-deck/node'
import { getBlackmagicControllerDeviceInfo } from '@blackmagic-controller/node'
import { usb } from 'usb'
import shuttleControlUSB from 'shuttle-control-usb'
// @ts-ignore
import vecFootpedal from 'vec-footpedal'
import { listLoupedecks, LoupedeckModelId } from '@loupedeck/node'
import { SurfaceHandler, getSurfaceName } from './Handler.js'
import { SurfaceIPElgatoEmulator, EmulatorRoom } from './IP/ElgatoEmulator.js'
import { SurfaceIPElgatoPlugin } from './IP/ElgatoPlugin.js'
import { SurfaceIPSatellite, SatelliteDeviceInfo } from './IP/Satellite.js'
import { SurfaceUSBElgatoStreamDeck } from './USB/ElgatoStreamDeck.js'
import { SurfaceUSBInfinitton } from './USB/Infinitton.js'
import { SurfaceUSBXKeys } from './USB/XKeys.js'
import { SurfaceUSBLoupedeckLive } from './USB/LoupedeckLive.js'
import { SurfaceUSBLoupedeckCt } from './USB/LoupedeckCt.js'
import { SurfaceUSBContourShuttle } from './USB/ContourShuttle.js'
import { SurfaceUSBVECFootpedal } from './USB/VECFootpedal.js'
import { SurfaceIPVideohubPanel, VideohubPanelDeviceInfo } from './IP/VideohubPanel.js'
import { SurfaceUSBFrameworkMacropad } from './USB/FrameworkMacropad.js'
import { SurfaceUSB203SystemsMystrix } from './USB/203SystemsMystrix.js'
import { CoreBase } from '../Core/Base.js'
import { SurfaceGroup } from './Group.js'
import { SurfaceOutboundController } from './Outbound.js'
import { SurfaceUSBBlackmagicController } from './USB/BlackmagicController.js'
import { VARIABLE_UNKNOWN_VALUE } from '../Variables/Util.js'
import type { ClientDevicesListItem, ClientSurfaceItem, SurfacesUpdate } from '@companion-app/shared/Model/Surfaces.js'
import type { Registry } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'
import type { StreamDeckTcp } from '@elgato-stream-deck/tcp'
import type { ServiceElgatoPluginSocket } from '../Service/ElgatoPlugin.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { LocalUSBDeviceOptions, SurfacePanel, SurfacePanelFactory } from './Types.js'

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')
HID.devices()

const SurfacesRoom = 'surfaces'

export class SurfaceController extends CoreBase {
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

	constructor(registry: Registry) {
		super(registry, 'Surface/Controller')

		this.#outboundController = new SurfaceOutboundController(this, registry.db, registry.io)

		this.#surfacesAllLocked = !!this.userconfig.getKey('link_lockouts')

		setImmediate(() => {
			// Setup groups
			const groupsConfigs = this.db.getKey('surface-groups', {})
			for (const groupId of Object.keys(groupsConfigs)) {
				const newGroup = new SurfaceGroup(
					this,
					this.db,
					this.page,
					this.userconfig,
					groupId,
					null,
					this.isPinLockEnabled()
				)
				this.#surfaceGroups.set(groupId, newGroup)
			}

			// Setup defined emulators
			const instances = this.db.getKey('deviceconfig', {}) || {}
			for (const id of Object.keys(instances)) {
				// If the id starts with 'emulator:' then re-add it
				if (id.startsWith('emulator:')) {
					this.addEmulator(id.substring(9))
				}
			}

			// Initial search for USB devices
			this.#refreshDevices().catch(() => {
				this.logger.warn('Initial USB scan failed')
			})
			this.#outboundController.init()

			this.updateDevicesList()

			this.#startStopLockoutTimer()
		})

		this.triggerRefreshDevicesEvent = this.triggerRefreshDevicesEvent.bind(this)

		const runHotplug = this.userconfig.getKey('usb_hotplug')
		if (runHotplug) {
			try {
				usb.on('attach', this.triggerRefreshDevicesEvent)
			} catch (e) {
				this.logger.error(`Failed to enable usb hotplug: ${e}`)
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
				this.logger.warn(`Failed to enable/disable usb hotplug: ${e}`)
			}
		} else if (key === 'pin_enable' || key === 'pin_timeout') {
			this.#startStopLockoutTimer()

			if (!this.isPinLockEnabled()) {
				// Ensure all are unlocked
				this.setAllLocked(false, true)
			}
		}
	}

	#startStopLockoutTimer() {
		// Stop existing timer
		if (this.#surfaceLockoutTimer) {
			clearInterval(this.#surfaceLockoutTimer)
			this.#surfaceLockoutTimer = null
		}

		// Start new timer
		const timeout = Number(this.userconfig.getKey('pin_timeout')) * 1000
		if (!isNaN(timeout) && timeout > 0 && !!this.userconfig.getKey('pin_enable')) {
			this.#surfaceLockoutTimer = setInterval(() => {
				if (this.userconfig.getKey('link_lockouts')) {
					if (this.#surfacesAllLocked) return

					let doLockout = false
					for (const surfaceGroup of this.#surfaceGroups.values()) {
						if (this.#isSurfaceGroupTimedOut(surfaceGroup.groupId, timeout)) {
							doLockout = true
							this.#surfacesLastInteraction.delete(surfaceGroup.groupId)
						}
					}

					if (doLockout) {
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

	triggerRefreshDevicesEvent(): void {
		this.triggerRefreshDevices().catch((e) => {
			this.logger.warn(`Hotplug device refresh failed: ${e}`)
		})
	}

	/**
	 * Add an emulator
	 * @param id base id of the emulator
	 * @param skipUpdate Skip emitting an update to the devices list
	 */
	addEmulator(id: string, skipUpdate = false): void {
		const fullId = EmulatorRoom(id)
		if (this.#surfaceHandlers.has(fullId)) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		this.#createSurfaceHandler(fullId, 'emulator', new SurfaceIPElgatoEmulator(this.io, id))

		if (!skipUpdate) this.updateDevicesList()
	}

	/**
	 * Create a `SurfaceHandler` for a `SurfacePanel`
	 */
	#createSurfaceHandler(surfaceId: string, integrationType: string, panel: SurfacePanel): void {
		const surfaceConfig = this.getDeviceConfig(panel.info.deviceId)
		if (!surfaceConfig) {
			this.logger.silly(`Creating config for newly discovered device ${panel.info.deviceId}`)
		} else {
			this.logger.silly(`Reusing config for device ${panel.info.deviceId}`)
		}

		const handler = new SurfaceHandler(this.registry, integrationType, panel, surfaceConfig)
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

			if (this.userconfig.getKey('link_lockouts')) {
				this.setAllLocked(false)
			} else {
				this.setSurfaceOrGroupLocked(groupId, false)
			}
		})

		this.#surfaceHandlers.set(surfaceId, handler)
		this.emit('surface-add', surfaceId)

		// Update the group to have the new surface
		this.#attachSurfaceToGroup(handler)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.#outboundController.clientConnect(client)

		client.onPromise('emulator:startup', (id) => {
			const fullId = EmulatorRoom(id)

			const surface = this.#surfaceHandlers.get(fullId)
			if (!surface || !(surface.panel instanceof SurfaceIPElgatoEmulator)) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			// Subscribe to the bitmaps
			client.join(fullId)

			return surface.panel.setupClient(client)
		})

		client.onPromise('emulator:press', (id, x, y) => {
			const fullId = EmulatorRoom(id)

			const surface = this.#surfaceHandlers.get(fullId)
			if (!surface) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			surface.panel.emit('click', x, y, true)
		})

		client.onPromise('emulator:release', (id, x, y) => {
			const fullId = EmulatorRoom(id)

			const surface = this.#surfaceHandlers.get(fullId)
			if (!surface) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			surface.panel.emit('click', x, y, false)
		})

		// client.onPromise(
		// 	'emulator:stop',
		// 	(id) => {
		// 		const fullId = EmulatorRoom(id)

		// 		client.leave(fullId)
		// 	}
		// )

		client.onPromise('surfaces:subscribe', () => {
			client.join(SurfacesRoom)

			return this.#lastSentJson
		})
		client.onPromise('surfaces:unsubscribe', () => {
			client.leave(SurfacesRoom)
		})

		client.onPromise('surfaces:rescan', async () => {
			try {
				return this.triggerRefreshDevices()
			} catch (e: any) {
				return e.message
			}
		})

		client.onPromise('surfaces:set-name', (id, name) => {
			// Find a matching group
			const group = this.#surfaceGroups.get(id)
			if (group && !group.isAutoGroup) {
				group.setName(name)
				this.updateDevicesList()
				return
			}

			// Find a connected surface
			for (let surface of this.#surfaceHandlers.values()) {
				if (surface && surface.surfaceId == id) {
					surface.setPanelName(name)
					this.updateDevicesList()
					return
				}
			}

			// Find a disconnected surface
			const configs = this.db.getKey('deviceconfig', {})
			if (configs[id]) {
				configs[id].name = name
				this.db.setKey('deviceconfig', configs)
				this.updateDevicesList()
				return
			}

			throw new Error('not found')
		})

		client.onPromise('surfaces:config-get', (id) => {
			for (const surface of this.#surfaceHandlers.values()) {
				if (surface && surface.surfaceId == id) {
					return surface.getPanelConfig()
				}
			}
			return null
		})

		client.onPromise('surfaces:config-set', (id, config) => {
			for (let surface of this.#surfaceHandlers.values()) {
				if (surface && surface.surfaceId == id) {
					surface.setPanelConfig(config)
					return surface.getPanelConfig()
				}
			}
			return 'device not found'
		})

		client.onPromise('surfaces:emulator-add', () => {
			// TODO - should this do friendlier ids?
			const id = nanoid()
			this.addEmulator(id)

			return id
		})

		client.onPromise('surfaces:emulator-remove', (id) => {
			if (id.startsWith('emulator:') && this.#surfaceHandlers.has(id)) {
				this.removeDevice(id, true)

				return true
			} else {
				return false
			}
		})

		client.onPromise('surfaces:forget', (id) => {
			for (const surface of this.#surfaceHandlers.values()) {
				if (!surface) continue

				if (surface.surfaceId == id) {
					return 'device is active'
				}
			}

			if (this.setDeviceConfig(id, undefined)) {
				this.updateDevicesList()

				return true
			}

			return 'device not found'
		})

		client.onPromise('surfaces:group-add', (name) => {
			if (!name || typeof name !== 'string') throw new Error('Invalid name')

			// TODO - should this do friendlier ids?
			const groupId = `group:${nanoid()}`

			const newGroup = new SurfaceGroup(
				this,
				this.db,
				this.page,
				this.userconfig,
				groupId,
				null,
				this.isPinLockEnabled()
			)
			newGroup.setName(name)
			this.#surfaceGroups.set(groupId, newGroup)

			this.updateDevicesList()

			return groupId
		})

		client.onPromise('surfaces:group-remove', (groupId) => {
			const group = this.#surfaceGroups.get(groupId)
			if (!group || group.isAutoGroup) throw new Error(`Group does not exist`)

			// Clear the group for all surfaces
			for (const surfaceHandler of group.surfaceHandlers) {
				surfaceHandler.setGroupId(null)
				this.#attachSurfaceToGroup(surfaceHandler)
			}

			group.dispose()
			group.forgetConfig()
			this.#surfaceGroups.delete(groupId)

			this.updateDevicesList()

			return groupId
		})

		client.onPromise('surfaces:add-to-group', (groupId, surfaceId) => {
			const group = groupId ? this.#surfaceGroups.get(groupId) : null
			if (groupId && !group) throw new Error(`Group does not exist: ${groupId}`)

			const surfaceHandler = Array.from(this.#surfaceHandlers.values()).find(
				(surface) => surface && surface.surfaceId === surfaceId
			)
			if (!surfaceHandler) throw new Error(`Surface does not exist or is not connected: ${surfaceId}`)
			// TODO - we can handle this if it is still in the config

			this.#detachSurfaceFromGroup(surfaceHandler)

			surfaceHandler.setGroupId(groupId)

			this.#attachSurfaceToGroup(surfaceHandler)

			this.updateDevicesList()
		})

		client.onPromise('surfaces:group-config-get', (groupId) => {
			const group = this.#surfaceGroups.get(groupId)
			if (!group) throw new Error(`Group does not exist: ${groupId}`)

			return group.groupConfig
		})

		client.onPromise('surfaces:group-config-set', (groupId, key, value) => {
			const group = this.#surfaceGroups.get(groupId)
			if (!group) throw new Error(`Group does not exist: ${groupId}`)

			const err = group.setGroupConfigValue(key, value)
			if (err) return err

			return group.groupConfig
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
				const timeout = Number(this.userconfig.getKey('pin_timeout')) * 1000
				if (this.userconfig.getKey('link_lockouts')) {
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
				this.db,
				this.page,
				this.userconfig,
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
	getDeviceConfig(surfaceId: string): any {
		const config = this.db.getKey('deviceconfig', {})
		return config[surfaceId]
	}

	/**
	 * Set the config object for a surface
	 * @returns Already had config
	 */
	setDeviceConfig(surfaceId: string, surfaceConfig: any | undefined): boolean {
		const config = this.db.getKey('deviceconfig', {})
		const exists = !!config[surfaceId]

		if (surfaceConfig) {
			config[surfaceId] = surfaceConfig
		} else {
			delete config[surfaceId]
		}

		this.db.setKey('deviceconfig', config)
		return exists
	}

	getDevicesList(): ClientDevicesListItem[] {
		const translateSurfaceConfig = (
			id: string,
			config: Record<string, any>,
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

				size: config?.gridSize || null,
				offset: { columns: config?.xOffset ?? 0, rows: config?.yOffset ?? 0 },
			}

			if (surfaceHandler) {
				let location = surfaceHandler.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				surfaceInfo.location = location || null
				surfaceInfo.configFields = surfaceHandler.panel.info.configFields || []
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
		surfaceGroups.forEach((group, index) => {
			const groupResult: ClientDevicesListItem = {
				id: group.groupId,
				index: index,
				displayName: group.displayName,
				isAutoGroup: group.isAutoGroup,
				surfaces: group.surfaceHandlers.map((handler) =>
					translateSurfaceConfig(handler.surfaceId, handler.getFullConfig(), handler)
				),
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
		const config: Record<string, any> = this.db.getKey('deviceconfig', {})
		for (const [surfaceId, surface] of Object.entries(config)) {
			if (mappedSurfaceId.has(surfaceId)) continue

			const groupId = surface.groupId || surfaceId

			const existingGroup = groupsMap.get(groupId)
			if (existingGroup) {
				existingGroup.surfaces.push(translateSurfaceConfig(surfaceId, surface, null))
			} else {
				const groupResult: ClientDevicesListItem = {
					id: groupId,
					index: undefined,
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
		this.db.setKey('deviceconfig', {})
		this.db.setKey('surface-groups', {})
		this.#outboundController.reset()

		// Wait for the surfaces to disconnect before clearing their config
		await new Promise((resolve) => setTimeout(resolve, 500))

		this.#resetAllDevices()
		this.updateDevicesList()
	}

	updateDevicesList(): void {
		const newJsonArr = cloneDeep(this.getDevicesList())

		const hasSubscribers = this.io.countRoomMembers(SurfacesRoom) > 0

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

			this.io.emitToRoom(SurfacesRoom, `surfaces:update`, changes)
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
			const streamdeckDisabled = !!this.userconfig.getKey('elgato_plugin_enable')

			try {
				// Make sure we don't try to take over stream deck devices when the stream deck application
				// is running on windows.
				if (!streamdeckDisabled && process.platform === 'win32') {
					const list = await findProcess('name', 'Stream Deck')
					if (typeof list === 'object' && list.length > 0) {
						streamDeckSoftwareRunning = true
						this.logger.silly('Elgato software detected, ignoring stream decks')
					}
				}
			} catch (e) {
				// scan for all usb devices anyways
			}

			// Now do the scan
			const scanForLoupedeck = !!this.userconfig.getKey('loupedeck_enable')
			this.logger.silly('scanForLoupedeck', scanForLoupedeck)
			const ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled
			this.logger.silly('USB: checking devices')

			try {
				await Promise.allSettled([
					HID.devicesAsync().then(async (deviceInfos) =>
						Promise.allSettled(
							deviceInfos.map(async (deviceInfo) => {
								if (deviceInfo.path && !this.#surfaceHandlers.has(deviceInfo.path)) {
									if (!ignoreStreamDeck) {
										if (getStreamDeckDeviceInfo(deviceInfo)) {
											await this.#addDevice(deviceInfo.path, {}, 'elgato-streamdeck', SurfaceUSBElgatoStreamDeck)
											return
										}
									}

									if (
										deviceInfo.vendorId === 0xffff &&
										(deviceInfo.productId === 0x1f40 || deviceInfo.productId === 0x1f41)
									) {
										await this.#addDevice(deviceInfo.path, {}, 'infinitton', SurfaceUSBInfinitton)
									} else if (
										// More specific match has to be above xkeys
										deviceInfo.vendorId === vecFootpedal.vids.VEC &&
										deviceInfo.productId === vecFootpedal.pids.FOOTPEDAL
									) {
										if (this.userconfig.getKey('vec_footpedal_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'vec-footpedal', SurfaceUSBVECFootpedal)
										}
									} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
										if (this.userconfig.getKey('xkeys_enable')) {
											await this.#addDevice(
												deviceInfo.path,
												{
													useLegacyLayout: !!this.userconfig.getKey('xkeys_legacy_layout'),
												},
												'xkeys',
												SurfaceUSBXKeys
											)
										}
									} else if (
										deviceInfo.vendorId === shuttleControlUSB.vids.CONTOUR &&
										(deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEXPRESS ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V1 ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V2)
									) {
										if (this.userconfig.getKey('contour_shuttle_enable')) {
											await this.#addDevice(deviceInfo.path, {}, 'contour-shuttle', SurfaceUSBContourShuttle)
										}
									} else if (
										deviceInfo.vendorId === 0x32ac && // frame.work
										deviceInfo.productId === 0x0013 && // macropod
										deviceInfo.usagePage === 0xffdd && // rawhid interface
										deviceInfo.usage === 0x61
									) {
										await this.#addDevice(deviceInfo.path, {}, 'framework-macropad', SurfaceUSBFrameworkMacropad)
									} else if (
										this.userconfig.getKey('blackmagic_controller_enable') &&
										getBlackmagicControllerDeviceInfo(deviceInfo)
									) {
										await this.#addDevice(deviceInfo.path, {}, 'blackmagic-controller', SurfaceUSBBlackmagicController)
									} else if (
										deviceInfo.vendorId === 0x0203 && // 203 Systems
										(deviceInfo.productId & 0xffc0) == 0x1040 && // Mystrix
										deviceInfo.usagePage === 0xff00 && // rawhid interface
										deviceInfo.usage === 0x01
									) {
										if (this.userconfig.getKey('mystrix_enable')) {
											await this.#addDevice(deviceInfo.path, {}, '203-mystrix', SurfaceUSB203SystemsMystrix)
										}
									}
								}
							})
						)
					),
					scanForLoupedeck
						? listLoupedecks().then((deviceInfos) =>
								Promise.allSettled(
									deviceInfos.map(async (deviceInfo) => {
										this.logger.info('found loupedeck', deviceInfo)
										if (!this.#surfaceHandlers.has(deviceInfo.path)) {
											if (
												deviceInfo.model === LoupedeckModelId.LoupedeckLive ||
												deviceInfo.model === LoupedeckModelId.LoupedeckLiveS ||
												deviceInfo.model === LoupedeckModelId.RazerStreamController ||
												deviceInfo.model === LoupedeckModelId.RazerStreamControllerX
											) {
												await this.#addDevice(deviceInfo.path, {}, 'loupedeck-live', SurfaceUSBLoupedeckLive, true)
											} else if (
												deviceInfo.model === LoupedeckModelId.LoupedeckCt ||
												deviceInfo.model === LoupedeckModelId.LoupedeckCtV1
											) {
												await this.#addDevice(deviceInfo.path, {}, 'loupedeck-ct', SurfaceUSBLoupedeckCt, true)
											}
										}
									})
								)
							)
						: null,
				])

				this.logger.silly('USB: done')

				if (streamdeckDisabled) {
					return 'Ignoring Stream Decks devices as the plugin has been enabled'
				} else if (ignoreStreamDeck) {
					return 'Ignoring Stream Decks devices as the stream deck app is running'
				} else {
					return undefined
				}
			} catch (e) {
				this.logger.silly('USB: scan failed ' + e)
				throw 'Scan failed'
			}
		} finally {
			this.#runningRefreshDevices = false
		}
	}

	async addStreamdeckTcpDevice(streamdeck: StreamDeckTcp) {
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

		const device = new SurfaceIPElgatoPlugin(this.controls, this.page, devicePath, socket)

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

		this.logger.silly('add device ' + devicePath)

		if (!skipHidAccessCheck) {
			// Check if we have access to the device
			try {
				const devicetest = new HID.HID(devicePath)
				devicetest.close()
			} catch (e) {
				this.logger.error(
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
			this.logger.error(`Failed to add "${type}" device: ${e}`)

			// Failed, remove the placeholder
			this.#surfaceHandlers.delete(devicePath)
		}
	}

	#surfaceExecuteExpression(
		str: string,
		surfaceId: string,
		injectedVariableValues: CompanionVariableValues | undefined
	) {
		const injectedVariableValuesComplete = {
			...this.#getInjectedVariablesForSurfaceId(surfaceId),
			...injectedVariableValues,
		}

		return this.variablesController.values.executeExpression(str, undefined, undefined, injectedVariableValuesComplete)
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

	exportAll(clone = true): any {
		const obj = this.db.getKey('deviceconfig', {}) || {}
		return clone ? cloneDeep(obj) : obj
	}

	exportAllGroups(clone = true): any {
		const obj = this.db.getKey('surface-groups', {}) || {}
		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Import a surface configuration
	 */
	importSurfaces(surfaceGroups: Record<string, any>, surfaces: Record<string, any>): void {
		for (const [id, surfaceGroup] of Object.entries(surfaceGroups)) {
			let group = this.#getGroupForId(id, true)
			if (!group) {
				// Group does not exist
				group = new SurfaceGroup(this, this.db, this.page, this.userconfig, id, null, this.isPinLockEnabled())
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
				surface.saveGroupConfig(surfaceConfig.groupConfig)
				surface.setPanelName(surfaceConfig.name)

				// Update the groupId
				const newGroupId = surfaceConfig.groupId ?? null
				if (surface.getGroupId() !== newGroupId && this.#getGroupForId(newGroupId)) {
					this.#detachSurfaceFromGroup(surface)
					surface.setGroupId(newGroupId)
					this.#attachSurfaceToGroup(surface)
				}
			} else {
				// Device is not loaded
				this.setDeviceConfig(surfaceId, surfaceConfig)

				if (surfaceId.startsWith('emulator:')) {
					this.addEmulator(surfaceId.substring(9))
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
			this.logger.silly('remove device ' + devicePath)

			const surfaceId = surfaceHandler.surfaceId

			// Detach surface from any group
			this.#detachSurfaceFromGroup(surfaceHandler)

			try {
				surfaceHandler.unload(purge)
			} catch (e) {
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
			} catch (e) {
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
			} catch (e) {
				this.logger.warn('Could not reattach a surface')
			}
		}
	}

	/**
	 * Is pin lock enabled
	 * @returns {boolean}
	 */
	isPinLockEnabled(): boolean {
		return !!this.userconfig.getKey('pin_enable')
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

		if (this.userconfig.getKey('link_lockouts')) {
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

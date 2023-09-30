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
import { usb } from 'usb'
import shuttleControlUSB from 'shuttle-control-usb'
import { listLoupedecks, LoupedeckModelId } from '@loupedeck/node'
import SurfaceHandler, { getSurfaceName } from './Handler.js'
import SurfaceIPElgatoEmulator, { EmulatorRoom } from './IP/ElgatoEmulator.js'
import SurfaceIPElgatoPlugin from './IP/ElgatoPlugin.js'
import SurfaceIPSatellite from './IP/Satellite.js'
import ElgatoStreamDeckDriver from './USB/ElgatoStreamDeck.js'
import InfinittonDriver from './USB/Infinitton.js'
import XKeysDriver from './USB/XKeys.js'
import LoupedeckLiveDriver from './USB/LoupedeckLive.js'
import SurfaceUSBLoupedeckCt from './USB/LoupedeckCt.js'
import ContourShuttleDriver from './USB/ContourShuttle.js'
import SurfaceIPVideohubPanel from './IP/VideohubPanel.js'
import CoreBase from '../Core/Base.js'
import { SurfaceGroup } from './Group.js'

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')
HID.devices()

const SurfacesRoom = 'surfaces'

class SurfaceController extends CoreBase {
	/**
	 * The last sent json object
	 * @type {object | null}
	 * @access private
	 */
	#lastSentJson = null

	/**
	 * All the opened and active surfaces
	 * @type {Map<string, SurfaceHandler >}
	 * @access private
	 */
	#surfaceHandlers = new Map()

	/**
	 * The surface groups wrapping the surface handlers
	 * @type {Map<string, SurfaceGroup >}
	 * @access private
	 */
	#surfaceGroups = new Map()

	/**
	 * Last time each surface was interacted with, for lockouts
	 * The values get cleared when a surface is locked, and remains while unlocked
	 * @access private
	 */
	#surfacesLastInteraction = {}

	/**
	 * Timer for lockout checking
	 * @type {NodeJS.Timeout | null}
	 * @access private
	 */
	#surfaceLockoutTimer = null

	/**
	 * If lockouts are linked, track whether they are currently locked
	 * @access private
	 */
	#surfacesAllLocked = false

	/**
	 * Whether usb hotplug is currently configured and running
	 * @access private
	 */
	#runningUsbHotplug = false

	/**
	 * Whether a usb scan is currently in progress
	 * @access private
	 */
	#runningRefreshDevices = false

	constructor(registry) {
		super(registry, 'surfaces', 'Surface/Controller')

		this.#surfacesAllLocked = !!this.userconfig.getKey('link_lockouts')

		setImmediate(() => {
			// Setup groups
			const groupsConfigs = this.db.getKey('surface-groups', {})
			for (const groupId of Object.keys(groupsConfigs)) {
				const newGroup = new SurfaceGroup(this.registry, groupId, null)
				this.#surfaceGroups.set(groupId, newGroup)
			}

			// Setup defined emulators
			{
				const instances = this.db.getKey('deviceconfig', {}) || {}
				for (const id of Object.keys(instances)) {
					// If the id starts with 'emulator:' then re-add it
					if (id.startsWith('emulator:')) {
						this.addEmulator(id.substring(9))
					}
				}
			}

			// Initial search for USB devices
			this.#refreshDevices().catch((e) => {
				this.logger.warn('Initial USB scan failed')
			})

			this.updateDevicesList()

			this.#startStopLockoutTimer()
		})

		this.triggerRefreshDevices = pDebounce(async () => this.#refreshDevices(), 50, {
			before: false,
		})

		this.triggerRefreshDevicesEvent = this.triggerRefreshDevicesEvent.bind(this)

		const runHotplug = this.userconfig.getKey('usb_hotplug')
		if (runHotplug) {
			usb.on('attach', this.triggerRefreshDevicesEvent)
			this.#runningUsbHotplug = true
		}
	}

	updateUserConfig(key, value) {
		if (key === 'usb_hotplug') {
			if (!value && this.#runningUsbHotplug) {
				// Stop watching
				usb.off('attach', this.triggerRefreshDevicesEvent)
				this.#runningUsbHotplug = false
			} else if (value && !this.#runningUsbHotplug) {
				// Start watching
				usb.on('attach', this.triggerRefreshDevicesEvent)
				this.#runningUsbHotplug = true
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
					for (const surface of this.#surfaceHandlers.values()) {
						if (this.#isSurfaceTimedOut(surface.deviceId, timeout)) {
							doLockout = true
							delete this.#surfacesLastInteraction[surface.deviceId]
						}
					}

					if (doLockout) {
						this.setAllLocked(true)
					}
				} else {
					for (const surface of this.#surfaceHandlers.values()) {
						if (this.#isSurfaceTimedOut(surface.deviceId, timeout)) {
							delete this.#surfacesLastInteraction[surface.deviceId]
							this.setDeviceLocked(surface.deviceId, true)
						}
					}
				}
			}, 1000)
		}
	}

	#isSurfaceTimedOut(deviceId, timeout) {
		if (!this.isPinLockEnabled()) return false

		const lastInteraction = this.#surfacesLastInteraction[deviceId] || 0
		return lastInteraction + timeout < Date.now()
	}

	triggerRefreshDevicesEvent() {
		this.triggerRefreshDevices().catch((e) => {
			this.logger.warn(`Hotplug device refresh failed: ${e}`)
		})
	}

	addEmulator(id, skipUpdate) {
		const fullId = EmulatorRoom(id)
		if (this.#surfaceHandlers.has(fullId)) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		this.#createSurfaceHandler(fullId, 'emulator', new SurfaceIPElgatoEmulator(this.registry, id))

		if (!skipUpdate) this.updateDevicesList()
	}

	#createSurfaceHandler(surfaceId, integrationType, panel) {
		const deviceId = panel.info.deviceId

		let isLocked = false
		if (this.isPinLockEnabled()) {
			const timeout = Number(this.userconfig.getKey('pin_timeout')) * 1000
			if (this.userconfig.getKey('link_lockouts')) {
				isLocked = this.#surfacesAllLocked
			} else if (timeout && !isNaN(timeout)) {
				isLocked = this.#isSurfaceTimedOut(deviceId, timeout)
			} else {
				isLocked = !this.#surfacesLastInteraction[deviceId]
			}
		}

		const handler = new SurfaceHandler(this.registry, integrationType, panel, isLocked)
		handler.on('interaction', () => {
			this.#surfacesLastInteraction[deviceId] = Date.now()
		})
		handler.on('unlocked', () => {
			this.#surfacesLastInteraction[deviceId] = Date.now()

			if (this.userconfig.getKey('link_lockouts')) {
				this.setAllLocked(false)
			}
		})

		this.#surfaceHandlers.set(surfaceId, handler)
		if (!isLocked) {
			// If not already locked, keep it unlocked for the full timeout
			this.#surfacesLastInteraction[deviceId] = Date.now()
		}

		// Update the group to have the new surface
		this.#attachSurfaceToGroup(handler)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('emulator:startup', (id) => {
			const fullId = EmulatorRoom(id)

			const surface = this.#surfaceHandlers.get(fullId)
			if (!surface) {
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

		client.onPromise('emulator:stop', (id) => {
			const fullId = EmulatorRoom(id)

			client.leave(fullId)
		})

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
			} catch (e) {
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
				if (surface && surface.deviceId == id) {
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
			for (let surface of this.#surfaceHandlers.values()) {
				if (surface && surface.deviceId == id) {
					return [surface.getPanelConfig(), surface.getPanelInfo()]
				}
			}
			return null
		})

		client.onPromise('surfaces:config-set', (id, config) => {
			for (let surface of this.#surfaceHandlers.values()) {
				if (surface && surface.deviceId == id) {
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
			if (id.startsWith('emulator:') && this.#surfaceHandlers[id]) {
				this.removeDevice(id, true)

				return true
			} else {
				return false
			}
		})

		client.onPromise('surfaces:forget', (id) => {
			for (let surface of this.#surfaceHandlers.values()) {
				if (surface.deviceId == id) {
					return 'device is active'
				}
			}

			const config = this.db.getKey('deviceconfig', {})
			if (config[id]) {
				delete config[id]
				this.db.setKey('deviceconfig', config)

				this.updateDevicesList()

				return true
			}

			return 'device not found'
		})

		client.onPromise('surfaces:group-add', (name) => {
			if (!name || typeof name !== 'string') throw new Error('Invalid name')

			// TODO - should this do friendlier ids?
			const groupId = `group:${nanoid()}`

			const newGroup = new SurfaceGroup(this.registry, groupId, null)
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
			group.forget()
			this.#surfaceGroups.delete(groupId)

			this.updateDevicesList()

			return groupId
		})

		client.onPromise('surfaces:add-to-group', (groupId, surfaceId) => {
			const group = groupId ? this.#surfaceGroups.get(groupId) : null
			if (groupId && !group) throw new Error(`Group does not exist: ${groupId}`)

			const surfaceHandler = Array.from(this.#surfaceHandlers.values()).find(
				(surface) => surface.deviceId === surfaceId
			)
			if (!surfaceHandler) throw new Error(`Surface does not exist or is not connected: ${surfaceId}`)
			// TODO - we can handle this if it is still in the config

			this.#detachSurfaceFromGroup(surfaceHandler)

			surfaceHandler.setGroupId(groupId)

			this.#attachSurfaceToGroup(surfaceHandler)

			this.updateDevicesList()
		})

		client.onPromise('surfaces:group-config-set', (groupId, key, value) => {
			const group = this.#surfaceGroups.get(groupId)
			if (!group) throw new Error(`Group does not exist: ${groupId}`)

			return group.setGroupConfigValue(key, value)
		})
	}

	#attachSurfaceToGroup(surfaceHandler) {
		const rawSurfaceGroupId = surfaceHandler.getGroupId()
		const surfaceGroupId = rawSurfaceGroupId || surfaceHandler.deviceId
		const existingGroup = this.#surfaceGroups.get(surfaceGroupId)
		if (existingGroup) {
			existingGroup.attachSurface(surfaceHandler)
		} else {
			const newGroup = new SurfaceGroup(this.registry, surfaceGroupId, !rawSurfaceGroupId ? surfaceHandler : null)
			this.#surfaceGroups.set(surfaceGroupId, newGroup)
		}
	}

	#detachSurfaceFromGroup(surfaceHandler) {
		const existingGroupId = surfaceHandler.getGroupId() || surfaceHandler.deviceId
		const existingGroup = existingGroupId ? this.#surfaceGroups.get(existingGroupId) : null
		if (!existingGroup) return

		existingGroup.detachSurface(surfaceHandler)

		// Cleanup an auto surface group
		if (existingGroup.isAutoGroup) {
			existingGroup.dispose()
			this.#surfaceGroups.delete(existingGroupId)
		}
	}

	getDevicesList() {
		function translateSurfaceConfig(id, config, instance) {
			const surfaceInfo = {
				id: id,
				type: config?.type || 'Unknown',
				integrationType: config?.integrationType || '',
				name: config?.name || '',
				// location: 'Offline',
				configFields: [],
				isConnected: !!instance,
				displayName: getSurfaceName(config, id),
			}

			if (instance) {
				let location = instance.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				surfaceInfo.location = location || null
				surfaceInfo.configFields = instance.panel.info.configFields || []
			}

			return surfaceInfo
		}

		const result = []

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

		const groupsMap = new Map()
		surfaceGroups.forEach((group, index) => {
			const groupResult = {
				id: group.groupId,
				index: index,
				displayName: group.displayName,
				isAutoGroup: group.isAutoGroup,
				surfaces: group.surfaceHandlers.map((handler) =>
					translateSurfaceConfig(handler.deviceId, handler.panelconfig, handler)
				),
			}
			result.push(groupResult)
			groupsMap.set(group.groupId, groupResult)
		})

		const mappedSurfaceId = new Set()
		for (const group of result) {
			for (const surface of group.surfaces) {
				mappedSurfaceId.add(surface.id)
			}
		}

		// Add any automatic groups for offline surfaces
		const config = this.db.getKey('deviceconfig', {})
		for (const [surfaceId, surface] of Object.entries(config)) {
			if (mappedSurfaceId.has(surfaceId)) continue

			const groupId = surface.groupId || surfaceId

			const existingGroup = groupsMap.get(groupId)
			if (existingGroup) {
				existingGroup.surfaces.push(translateSurfaceConfig(surfaceId, surface, null))
			} else {
				const groupResult = {
					id: groupId,
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

	reset() {
		// Each active handler will re-add itself when doing the save as part of its own reset
		this.db.setKey('deviceconfig', {})
		this.#resetAllDevices()
		this.updateDevicesList()
	}

	updateDevicesList() {
		const newJson = cloneDeep(this.getDevicesList())

		if (this.io.countRoomMembers(SurfacesRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastSentJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(SurfacesRoom, `surfaces:patch`, patch)
			}
		}
		this.#lastSentJson = newJson
	}

	async #refreshDevices() {
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
											await this.#addDevice(deviceInfo, 'elgato-streamdeck', ElgatoStreamDeckDriver)
											return
										}
									}

									if (
										deviceInfo.vendorId === 0xffff &&
										(deviceInfo.productId === 0x1f40 || deviceInfo.productId === 0x1f41)
									) {
										await this.#addDevice(deviceInfo, 'infinitton', InfinittonDriver)
									} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
										if (this.userconfig.getKey('xkeys_enable')) {
											deviceInfo.options = {
												useLegacyLayout: !!this.userconfig.getKey('xkeys_legacy_layout'),
											}
											await this.#addDevice(deviceInfo, 'xkeys', XKeysDriver)
										}
									} else if (
										deviceInfo.vendorId === shuttleControlUSB.vids.CONTOUR &&
										(deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEXPRESS ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V1 ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V2)
									) {
										if (this.userconfig.getKey('contour_shuttle_enable')) {
											await this.#addDevice(deviceInfo, 'contour-shuttle', ContourShuttleDriver)
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
										this.logger.log('info', 'found loupedeck', deviceInfo)
										if (!this.#surfaceHandlers.has(deviceInfo.path)) {
											if (
												deviceInfo.model === LoupedeckModelId.LoupedeckLive ||
												deviceInfo.model === LoupedeckModelId.LoupedeckLiveS ||
												deviceInfo.model === LoupedeckModelId.RazerStreamController ||
												deviceInfo.model === LoupedeckModelId.RazerStreamControllerX
											) {
												await this.#addDevice(deviceInfo, 'loupedeck-live', LoupedeckLiveDriver, true)
											} else if (deviceInfo.model === LoupedeckModelId.LoupedeckCt) {
												await this.#addDevice(deviceInfo, 'loupedeck-ct', SurfaceUSBLoupedeckCt, true)
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

	addSatelliteDevice(deviceInfo) {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPSatellite(deviceInfo)

		this.#createSurfaceHandler(deviceInfo.path, 'satellite', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	addVideohubPanelDevice(deviceInfo) {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPVideohubPanel(deviceInfo)

		this.#createSurfaceHandler(deviceInfo.path, 'videohub-panel', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	addElgatoPluginDevice(devicePath, socket, clientInfo) {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(this.registry, devicePath, socket, clientInfo)

		this.#createSurfaceHandler(devicePath, 'elgato-plugin', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	async #addDevice(deviceInfo, type, factory, skipHidAccessCheck) {
		this.removeDevice(deviceInfo.path)

		this.logger.silly('add device ' + deviceInfo.path)

		if (!skipHidAccessCheck) {
			// Check if we have access to the device
			try {
				const devicetest = new HID.HID(deviceInfo.path)
				devicetest.close()
			} catch (e) {
				this.logger.error(
					`Found "${type}" device, but no access. Please quit any other applications using the device, and try again.`
				)
				return
			}
		}

		try {
			const dev = await factory.create(deviceInfo.path, deviceInfo.options)
			this.#createSurfaceHandler(deviceInfo.path, type, dev)

			setImmediate(() => {
				this.updateDevicesList()
			})
		} catch (e) {
			this.logger.error(`Failed to add "${type}" device: ${e}`)
		}
	}

	exportAll(clone = true) {
		const obj = this.db.getKey('deviceconfig', {}) || {}
		return clone ? cloneDeep(obj) : obj
	}

	importSurface(deviceId, config) {
		const device = this.#getDeviceForId(deviceId, true)
		if (device) {
			// Device is currently loaded
			device.setPanelConfig(config)
		} else {
			// Device is not loaded
			const obj = this.db.getKey('deviceconfig', {}) || {}
			obj[deviceId] = config
			this.db.setKey('deviceconfig', obj)
		}

		this.updateDevicesList()
	}

	removeDevice(devicePath, purge) {
		const surfaceHandler = this.#surfaceHandlers.get(devicePath)
		if (surfaceHandler !== undefined) {
			this.logger.silly('remove device ' + devicePath)

			// Detach surface from any group
			this.#detachSurfaceFromGroup(surfaceHandler)

			try {
				surfaceHandler.unload(purge)
			} catch (e) {
				// Ignore for now
			}

			surfaceHandler.removeAllListeners()

			this.#surfaceHandlers.delete(devicePath)
		}

		this.updateDevicesList()
	}

	quit() {
		for (const surface of this.#surfaceHandlers.values()) {
			if (!surface) continue
			try {
				surface.unload()
			} catch (e) {
				// Ignore for now
			}
		}

		this.#surfaceHandlers.clear()
		this.updateDevicesList()
	}

	getDeviceIdFromIndex(index) {
		for (const dev of this.getDevicesList()) {
			if (dev.index === index) {
				return dev.id
			}
		}
		return undefined
	}

	devicePageUp(deviceOrGroupId, looseIdMatching) {
		const surfaceGroup = this.#getGroupForId(deviceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageUp()
		}
	}
	devicePageDown(deviceOrGroupId, looseIdMatching) {
		const surfaceGroup = this.#getGroupForId(deviceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageDown()
		}
	}
	devicePageSet(deviceOrGroupId, page, looseIdMatching, defer = false) {
		const surfaceGroup = this.#getGroupForId(deviceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.setCurrentPage(page, defer)
		}
	}
	devicePageGet(deviceOrGroupId, looseIdMatching) {
		const surfaceGroup = this.#getGroupForId(deviceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			return surfaceGroup.getCurrentPage()
		} else {
			return undefined
		}
	}

	#resetAllDevices() {
		for (const surface of this.#surfaceHandlers.values()) {
			try {
				surface.resetConfig()
			} catch (e) {
				this.logger.warn('Could not reset a device')
			}
		}
	}

	isPinLockEnabled() {
		return !!this.userconfig.getKey('pin_enable')
	}

	setAllLocked(locked, forceUnlock) {
		// TODO-group?
		if (forceUnlock) {
			locked = false
		} else {
			if (!this.isPinLockEnabled()) return
		}

		this.#surfacesAllLocked = !!locked

		for (const surface of this.#surfaceHandlers.values()) {
			this.#surfacesLastInteraction[surface.deviceId] = Date.now()

			surface.setLocked(!!locked)
		}
	}

	setDeviceLocked(deviceId, locked, looseIdMatching) {
		// TODO-group
		if (!this.isPinLockEnabled()) return

		if (this.userconfig.getKey('link_lockouts')) {
			this.setAllLocked(locked)
		} else {
			this.#surfacesAllLocked = false

			// Track the lock/unlock state, even if the device isn't online
			if (locked) {
				delete this.#surfacesLastInteraction[deviceId]
			} else {
				this.#surfacesLastInteraction[deviceId] = Date.now()
			}

			const device = this.#getDeviceForId(deviceId, looseIdMatching)
			if (device) {
				device.setLocked(!!locked)
			}
		}
	}

	setDeviceBrightness(surfaceId, brightness, looseIdMatching) {
		const device = this.#getDeviceForId(surfaceId, looseIdMatching)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	#getGroupForId(deviceOrGroupId, looseIdMatching) {
		const matchingGroup = this.#surfaceGroups.get(deviceOrGroupId)
		if (matchingGroup) return matchingGroup

		const device = this.#getDeviceForId(deviceOrGroupId, looseIdMatching)
		if (device) {
			const groupId = device.getGroupId() || device.deviceId
			return this.#surfaceGroups.get(groupId)
		}

		return undefined
	}

	#getDeviceForId(deviceId, looseIdMatching) {
		if (deviceId === 'emulator') deviceId = 'emulator:emulator'

		const surfaces = Array.from(this.#surfaceHandlers.values())

		// try and find exact match
		let device = surfaces.find((d) => d.deviceId === deviceId)
		if (device) return device

		// only try more variations if the id isnt new format
		if (!looseIdMatching || deviceId.includes(':')) return undefined

		// try the most likely streamdeck prefix
		let deviceId2 = `streamdeck:${deviceId}`
		device = surfaces.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// it is unlikely, but it could be a loupedeck
		deviceId2 = `loupedeck:${deviceId}`
		device = surfaces.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// or maybe a satellite?
		deviceId2 = `satellite-${deviceId}`
		return surfaces.find((d) => d.deviceId === deviceId2)
	}
}

export default SurfaceController

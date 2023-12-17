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
// @ts-ignore
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
	 * @type {Record<string, ClientDevicesListItem> | null}
	 * @access private
	 */
	#lastSentJson = null

	/**
	 * All the opened and active surfaces
	 * @type {Map<string, SurfaceHandler>}
	 * @access private
	 */
	#surfaceHandlers = new Map()

	/**
	 * The surface groups wrapping the surface handlers
	 * @type {Map<string, SurfaceGroup>}
	 * @access private
	 */
	#surfaceGroups = new Map()

	/**
	 * Last time each surface was interacted with, for lockouts
	 * The values get cleared when a surface is locked, and remains while unlocked
	 * @type {Map<string, number>}
	 * @access private
	 */
	#surfacesLastInteraction = new Map()

	/**
	 * Timer for lockout checking
	 * @type {NodeJS.Timeout | null}
	 * @access private
	 */
	#surfaceLockoutTimer = null

	/**
	 * If lockouts are linked, track whether they are currently locked
	 * @type {boolean}
	 * @access private
	 */
	#surfacesAllLocked = false

	/**
	 * Whether usb hotplug is currently configured and running
	 * @type {boolean}
	 * @access private
	 */
	#runningUsbHotplug = false

	/**
	 * Whether a usb scan is currently in progress
	 * @type {boolean}
	 * @access private
	 */
	#runningRefreshDevices = false

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		super(registry, 'surfaces', 'Surface/Controller')

		this.#surfacesAllLocked = !!this.userconfig.getKey('link_lockouts')

		setImmediate(() => {
			// Setup groups
			const groupsConfigs = this.db.getKey('surface-groups', {})
			for (const groupId of Object.keys(groupsConfigs)) {
				const newGroup = new SurfaceGroup(this.registry, groupId, null, this.isPinLockEnabled())
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

			this.updateDevicesList()

			this.#startStopLockoutTimer()
		})

		this.triggerRefreshDevicesEvent = this.triggerRefreshDevicesEvent.bind(this)

		const runHotplug = this.userconfig.getKey('usb_hotplug')
		if (runHotplug) {
			usb.on('attach', this.triggerRefreshDevicesEvent)
			this.#runningUsbHotplug = true
		}
	}

	/**
	 * Trigger a rescan of connected devices
	 * @type {() => Promise<void | string>}
	 * @access public
	 */
	triggerRefreshDevices = pDebounce(async () => this.#refreshDevices(), 50, {
		before: false,
	})

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
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
	 * @param {string} groupId
	 * @param {number} timeout
	 * @returns {boolean}
	 */
	#isSurfaceGroupTimedOut(groupId, timeout) {
		if (!this.isPinLockEnabled()) return false

		const lastInteraction = this.#surfacesLastInteraction.get(groupId) || 0
		return lastInteraction + timeout < Date.now()
	}

	triggerRefreshDevicesEvent() {
		this.triggerRefreshDevices().catch((e) => {
			this.logger.warn(`Hotplug device refresh failed: ${e}`)
		})
	}

	/**
	 * Add an emulator
	 * @param {string} id base id of the emulator
	 * @param {boolean} skipUpdate Skip emitting an update to the devices list
	 */
	addEmulator(id, skipUpdate = false) {
		const fullId = EmulatorRoom(id)
		if (this.#surfaceHandlers.has(fullId)) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		this.#createSurfaceHandler(fullId, 'emulator', new SurfaceIPElgatoEmulator(this.registry.io, id))

		if (!skipUpdate) this.updateDevicesList()
	}

	/**
	 * Create a `SurfaceHandler` for a `SurfacePanel`
	 * @param {string} surfaceId
	 * @param {string} integrationType
	 * @param {import('./Handler.js').SurfacePanel} panel
	 * @returns {void}
	 */
	#createSurfaceHandler(surfaceId, integrationType, panel) {
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
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise(
			'emulator:startup',
			/**
			 * @param {string} id
			 * @returns {import('../Shared/Model/Common.js').EmulatorConfig}
			 */
			(id) => {
				const fullId = EmulatorRoom(id)

				const surface = this.#surfaceHandlers.get(fullId)
				if (!surface || !(surface.panel instanceof SurfaceIPElgatoEmulator)) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				// Subscribe to the bitmaps
				client.join(fullId)

				return surface.panel.setupClient(client)
			}
		)

		client.onPromise(
			'emulator:press',
			/**
			 * @param {string} id
			 * @param {number} x
			 * @param {number} y
			 * @returns {void}
			 */
			(id, x, y) => {
				const fullId = EmulatorRoom(id)

				const surface = this.#surfaceHandlers.get(fullId)
				if (!surface) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				surface.panel.emit('click', x, y, true)
			}
		)

		client.onPromise(
			'emulator:release',
			/**
			 * @param {string} id
			 * @param {number} x
			 * @param {number} y
			 * @returns {void}
			 */
			(id, x, y) => {
				const fullId = EmulatorRoom(id)

				const surface = this.#surfaceHandlers.get(fullId)
				if (!surface) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				surface.panel.emit('click', x, y, false)
			}
		)

		client.onPromise(
			'emulator:stop',
			/**
			 * @param {string} id
			 * @returns {void}
			 */
			(id) => {
				const fullId = EmulatorRoom(id)

				client.leave(fullId)
			}
		)

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
			} catch (/** @type {any} */ e) {
				return e.message
			}
		})

		client.onPromise(
			'surfaces:set-name',
			/**
			 * @param {string} id
			 * @param {string} name
			 * @returns {void}
			 */
			(id, name) => {
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
			}
		)

		client.onPromise(
			'surfaces:config-get',
			/**
			 * @param {string} id
			 * @returns {[config: unknown, info: unknown] | null}
			 */
			(id) => {
				for (const surface of this.#surfaceHandlers.values()) {
					if (surface && surface.surfaceId == id) {
						return surface.getPanelConfig()
					}
				}
				return null
			}
		)

		client.onPromise(
			'surfaces:config-set',
			/**
			 * @param {string} id
			 * @param {unknown} config
			 * @returns {string | undefined}
			 */
			(id, config) => {
				for (let surface of this.#surfaceHandlers.values()) {
					if (surface && surface.surfaceId == id) {
						surface.setPanelConfig(config)
						return surface.getPanelConfig()
					}
				}
				return 'device not found'
			}
		)

		client.onPromise(
			'surfaces:emulator-add',
			/**
			 * @returns {string}
			 */
			() => {
				// TODO - should this do friendlier ids?
				const id = nanoid()
				this.addEmulator(id)

				return id
			}
		)

		client.onPromise(
			'surfaces:emulator-remove',
			/**
			 * @param {string} id
			 * @returns {boolean}
			 */
			(id) => {
				if (id.startsWith('emulator:') && this.#surfaceHandlers.has(id)) {
					this.removeDevice(id, true)

					return true
				} else {
					return false
				}
			}
		)

		client.onPromise(
			'surfaces:forget',
			/**
			 * @param {string} id
			 * @returns {string | true}
			 */
			(id) => {
				for (let surface of this.#surfaceHandlers.values()) {
					if (surface.surfaceId == id) {
						return 'device is active'
					}
				}

				if (this.setDeviceConfig(id, undefined)) {
					this.updateDevicesList()

					return true
				}

				return 'device not found'
			}
		)

		client.onPromise(
			'surfaces:group-add',
			/**
			 * @param {string} name
			 * @returns {string}
			 */
			(name) => {
				if (!name || typeof name !== 'string') throw new Error('Invalid name')

				// TODO - should this do friendlier ids?
				const groupId = `group:${nanoid()}`

				const newGroup = new SurfaceGroup(this.registry, groupId, null, this.isPinLockEnabled())
				newGroup.setName(name)
				this.#surfaceGroups.set(groupId, newGroup)

				this.updateDevicesList()

				return groupId
			}
		)

		client.onPromise(
			'surfaces:group-remove',
			/**
			 * @param {string} groupId
			 * @returns {string}
			 */
			(groupId) => {
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
			}
		)

		client.onPromise(
			'surfaces:add-to-group',
			/**
			 * @param {string} groupId
			 * @param {string} surfaceId
			 * @returns {void}
			 */
			(groupId, surfaceId) => {
				const group = groupId ? this.#surfaceGroups.get(groupId) : null
				if (groupId && !group) throw new Error(`Group does not exist: ${groupId}`)

				const surfaceHandler = Array.from(this.#surfaceHandlers.values()).find(
					(surface) => surface.surfaceId === surfaceId
				)
				if (!surfaceHandler) throw new Error(`Surface does not exist or is not connected: ${surfaceId}`)
				// TODO - we can handle this if it is still in the config

				this.#detachSurfaceFromGroup(surfaceHandler)

				surfaceHandler.setGroupId(groupId)

				this.#attachSurfaceToGroup(surfaceHandler)

				this.updateDevicesList()
			}
		)

		client.onPromise(
			'surfaces:group-config-get',
			/**
			 * @param {string} groupId
			 * @returns {any}
			 */
			(groupId) => {
				const group = this.#surfaceGroups.get(groupId)
				if (!group) throw new Error(`Group does not exist: ${groupId}`)

				return group.groupConfig
			}
		)

		client.onPromise(
			'surfaces:group-config-set',
			/**
			 * @param {string} groupId
			 * @param {string} key
			 * @param {any} value
			 * @returns {any}
			 */
			(groupId, key, value) => {
				const group = this.#surfaceGroups.get(groupId)
				if (!group) throw new Error(`Group does not exist: ${groupId}`)

				const err = group.setGroupConfigValue(key, value)
				if (err) return err

				return group.groupConfig
			}
		)
	}

	/**
	 * Attach a `SurfaceHandler` to its `SurfaceGroup`
	 * @param {SurfaceHandler} surfaceHandler
	 * @returns {void}
	 */
	#attachSurfaceToGroup(surfaceHandler) {
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
				this.registry,
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
	 * @param {SurfaceHandler} surfaceHandler
	 * @returns {void}
	 */
	#detachSurfaceFromGroup(surfaceHandler) {
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
	 * @param {string} surfaceId
	 * @returns {any} Config object, or undefined
	 */
	getDeviceConfig(surfaceId) {
		const config = this.db.getKey('deviceconfig', {})
		return config[surfaceId]
	}

	/**
	 * Set the config object for a surface
	 * @param {string} surfaceId
	 * @param {any | undefined} surfaceConfig
	 * @returns {boolean} Already had config
	 */
	setDeviceConfig(surfaceId, surfaceConfig) {
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

	/**
	 *
	 * @returns {ClientDevicesListItem[]}
	 */
	getDevicesList() {
		/**
		 *
		 * @param {string} id
		 * @param {Record<string, any>} config
		 * @param {SurfaceHandler | null} surfaceHandler
		 * @returns {ClientSurfaceItem}
		 */
		function translateSurfaceConfig(id, config, surfaceHandler) {
			/** @type {ClientSurfaceItem} */
			const surfaceInfo = {
				id: id,
				type: config?.type || 'Unknown',
				integrationType: config?.integrationType || '',
				name: config?.name || '',
				// location: 'Offline',
				configFields: [],
				isConnected: !!surfaceHandler,
				displayName: getSurfaceName(config, id),
				location: null,
			}

			if (surfaceHandler) {
				let location = surfaceHandler.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				surfaceInfo.location = location || null
				surfaceInfo.configFields = surfaceHandler.panel.info.configFields || []
			}

			return surfaceInfo
		}

		/** @type {ClientDevicesListItem[]} */
		const result = []

		const surfaceGroups = Array.from(this.#surfaceGroups.values())
		surfaceGroups.sort(
			/**
			 * @param {SurfaceGroup} a
			 * @param {SurfaceGroup} b
			 * @returns -1 | 0 | 1
			 */
			(a, b) => {
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
			}
		)

		const groupsMap = new Map()
		surfaceGroups.forEach((group, index) => {
			/** @type {ClientDevicesListItem} */
			const groupResult = {
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
				/** @type {ClientDevicesListItem} */
				const groupResult = {
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

	reset() {
		// Each active handler will re-add itself when doing the save as part of its own reset
		this.db.setKey('deviceconfig', {})
		this.db.setKey('surface-groups', {})
		this.#resetAllDevices()
		this.updateDevicesList()
	}

	updateDevicesList() {
		const newJsonArr = cloneDeep(this.getDevicesList())
		/** @type {Record<string, ClientDevicesListItem>} */
		const newJson = {}
		for (const surface of newJsonArr) {
			newJson[surface.id] = surface
		}

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
											await this.#addDevice(
												{
													path: deviceInfo.path,
													options: {},
												},
												'elgato-streamdeck',
												ElgatoStreamDeckDriver
											)
											return
										}
									}

									if (
										deviceInfo.vendorId === 0xffff &&
										(deviceInfo.productId === 0x1f40 || deviceInfo.productId === 0x1f41)
									) {
										await this.#addDevice(
											{
												path: deviceInfo.path,
												options: {},
											},
											'infinitton',
											InfinittonDriver
										)
									} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
										if (this.userconfig.getKey('xkeys_enable')) {
											await this.#addDevice(
												{
													path: deviceInfo.path,
													options: {
														useLegacyLayout: !!this.userconfig.getKey('xkeys_legacy_layout'),
													},
												},
												'xkeys',
												XKeysDriver
											)
										}
									} else if (
										deviceInfo.vendorId === shuttleControlUSB.vids.CONTOUR &&
										(deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEXPRESS ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V1 ||
											deviceInfo.productId === shuttleControlUSB.pids.SHUTTLEPRO_V2)
									) {
										if (this.userconfig.getKey('contour_shuttle_enable')) {
											await this.#addDevice(
												{
													path: deviceInfo.path,
													options: {},
												},
												'contour-shuttle',
												ContourShuttleDriver
											)
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
												await this.#addDevice(
													{
														path: deviceInfo.path,
														options: {},
													},
													'loupedeck-live',
													LoupedeckLiveDriver,
													true
												)
											} else if (deviceInfo.model === LoupedeckModelId.LoupedeckCt) {
												await this.#addDevice(
													{
														path: deviceInfo.path,
														options: {},
													},
													'loupedeck-ct',
													SurfaceUSBLoupedeckCt,
													true
												)
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

	/**
	 * Add a satellite device
	 * @param {import('./IP/Satellite.js').SatelliteDeviceInfo} deviceInfo
	 * @returns {SurfaceIPSatellite}
	 */
	addSatelliteDevice(deviceInfo) {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPSatellite(deviceInfo)

		this.#createSurfaceHandler(deviceInfo.path, 'satellite', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	/**
	 * Add a new videohub panel
	 * @param {import('./IP/VideohubPanel.js').VideohubPanelDeviceInfo} deviceInfo
	 * @returns {SurfaceIPVideohubPanel}
	 */
	addVideohubPanelDevice(deviceInfo) {
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
	 * @param {string} devicePath
	 * @param {import('../Service/ElgatoPlugin.js').ServiceElgatoPluginSocket} socket
	 * @returns
	 */
	addElgatoPluginDevice(devicePath, socket) {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(this.registry, devicePath, socket)

		this.#createSurfaceHandler(devicePath, 'elgato-plugin', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	/**
	 *
	 * @param {LocalUSBDeviceInfo} deviceInfo
	 * @param {string} type
	 * @param {{ create: (path: string, options: LocalUSBDeviceOptions) => Promise<import('./Handler.js').SurfacePanel>}} factory
	 * @param {boolean} skipHidAccessCheck
	 * @returns
	 */
	async #addDevice(deviceInfo, type, factory, skipHidAccessCheck = false) {
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

	exportAllGroups(clone = true) {
		const obj = this.db.getKey('surface-groups', {}) || {}
		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Import a surface configuration
	 * @param {Record<string, *>} surfaceGroups
	 * @param {Record<string, *>} surfaces
	 * @returns {void}
	 */
	importSurfaces(surfaceGroups, surfaces) {
		for (const [id, surfaceGroup] of Object.entries(surfaceGroups)) {
			let group = this.#getGroupForId(id, true)
			if (!group) {
				// Group does not exist
				group = new SurfaceGroup(this.registry, id, null, this.isPinLockEnabled())
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
			}
		}

		this.updateDevicesList()
	}

	/**
	 * Remove a surface
	 * @param {string} devicePath
	 * @param {boolean=} purge
	 * @returns {void}
	 */
	removeDevice(devicePath, purge) {
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

	/**
	 * Find surfaceId by index
	 * @param {number} index
	 * @returns {string | undefined}
	 */
	getDeviceIdFromIndex(index) {
		for (const group of this.getDevicesList()) {
			if (group.index === index) {
				return group.id
			}
		}
		return undefined
	}

	/**
	 * Perform page-up for a surface
	 * @param {string} surfaceOrGroupId
	 * @param {boolean=} looseIdMatching
	 * @returns {void}
	 */
	devicePageUp(surfaceOrGroupId, looseIdMatching) {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageUp()
		}
	}
	/**
	 * Perform page-down for a surface
	 * @param {string} surfaceOrGroupId
	 * @param {boolean=} looseIdMatching
	 * @returns {void}
	 */
	devicePageDown(surfaceOrGroupId, looseIdMatching) {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.doPageDown()
		}
	}
	/**
	 * Set the page number for a surface
	 * @param {string} surfaceOrGroupId
	 * @param {number} page
	 * @param {boolean=} looseIdMatching
	 * @param {boolean=} defer Defer the drawing to the next tick
	 * @returns {void}
	 */
	devicePageSet(surfaceOrGroupId, page, looseIdMatching, defer = false) {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			surfaceGroup.setCurrentPage(page, defer)
		}
	}
	/**
	 * Get the page number of a surface
	 * @param {string} surfaceOrGroupId
	 * @param {boolean=} looseIdMatching
	 * @returns {number | undefined}
	 */
	devicePageGet(surfaceOrGroupId, looseIdMatching = false) {
		const surfaceGroup = this.#getGroupForId(surfaceOrGroupId, looseIdMatching)
		if (surfaceGroup) {
			return surfaceGroup.getCurrentPage()
		} else {
			return undefined
		}
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
		for (const surface of this.#surfaceHandlers.values()) {
			try {
				surface.resetConfig()

				this.#attachSurfaceToGroup(surface)
			} catch (e) {
				this.logger.warn('Could not reattach a surface')
			}
		}
	}

	/**
	 * Is pin lock enabled
	 * @returns {boolean}
	 */
	isPinLockEnabled() {
		return !!this.userconfig.getKey('pin_enable')
	}

	/**
	 * Set the locked state of all surfaces
	 * @param {boolean} locked
	 * @param {boolean} forceUnlock Force all surfaces to be unlocked
	 * @returns
	 */
	setAllLocked(locked, forceUnlock = false) {
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
	 * @param {string} surfaceOrGroupId
	 * @param {boolean} locked
	 * @param {boolean} looseIdMatching
	 * @returns {void}
	 */
	setSurfaceOrGroupLocked(surfaceOrGroupId, locked, looseIdMatching = false) {
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
	 * @param {string} surfaceId
	 * @param {number} brightness 0-100
	 * @param {boolean} looseIdMatching
	 * @returns {void}
	 */
	setDeviceBrightness(surfaceId, brightness, looseIdMatching = false) {
		const device = this.#getSurfaceHandlerForId(surfaceId, looseIdMatching)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	/**
	 * Get the `SurfaceGroup` for a surfaceId or groupId
	 * @param {string} surfaceOrGroupId
	 * @param {boolean} looseIdMatching
	 * @returns {SurfaceGroup | undefined}
	 */
	#getGroupForId(surfaceOrGroupId, looseIdMatching = false) {
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
	 * @param {string} surfaceId
	 * @param {boolean} looseIdMatching Loosely match the id, to handle old device naming
	 * @returns
	 */
	#getSurfaceHandlerForId(surfaceId, looseIdMatching) {
		if (surfaceId === 'emulator') surfaceId = 'emulator:emulator'

		const surfaces = Array.from(this.#surfaceHandlers.values())

		// try and find exact match
		let surface = surfaces.find((d) => d.surfaceId === surfaceId)
		if (surface) return surface

		// only try more variations if the id isnt new format
		if (!looseIdMatching || surfaceId.includes(':')) return undefined

		// try the most likely streamdeck prefix
		let surfaceId2 = `streamdeck:${surfaceId}`
		surface = surfaces.find((d) => d.surfaceId === surfaceId2)
		if (surface) return surface

		// it is unlikely, but it could be a loupedeck
		surfaceId2 = `loupedeck:${surfaceId}`
		surface = surfaces.find((d) => d.surfaceId === surfaceId2)
		if (surface) return surface

		// or maybe a satellite?
		surfaceId2 = `satellite-${surfaceId}`
		return surfaces.find((d) => d.surfaceId === surfaceId2)
	}
}

export default SurfaceController

/**
 * @typedef {import('../Shared/Model/Surfaces.js').ClientSurfaceItem} ClientSurfaceItem
 * @typedef {import('../Shared/Model/Surfaces.js').ClientDevicesListItem} ClientDevicesListItem
 */

/**
 * @typedef {{
 *   path: string
 *   options: LocalUSBDeviceOptions
 * }} LocalUSBDeviceInfo
 *
 * @typedef {{
 *   useLegacyLayout?: boolean
 * }} LocalUSBDeviceOptions
 */

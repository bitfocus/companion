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

import SurfaceHandler from './Handler.js'
import SurfaceIPElgatoEmulator, { EmulatorRoom } from './IP/ElgatoEmulator.js'
import SurfaceIPElgatoPlugin from './IP/ElgatoPlugin.js'
import SurfaceIPSatellite from './IP/Satellite.js'

import ElgatoStreamDeckDriver from './USB/ElgatoStreamDeck.js'
import InfinittonDriver from './USB/Infinitton.js'
import XKeysDriver from './USB/XKeys.js'
import LoupedeckLiveDriver from './USB/LoupedeckLive.js'
import SurfaceUSBLoupedeckCt from './USB/LoupedeckCt.js'
import ContourShuttleDriver from './USB/ContourShuttle.js'

import CoreBase from '../Core/Base.js'
import SurfaceIPVideohubPanel from './IP/VideohubPanel.js'

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')
HID.devices()

const SurfacesRoom = 'surfaces'

class SurfaceController extends CoreBase {
	/**
	 * The last sent json object
	 * @type {ClientDevicesList | null}
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
		this.#refreshDevices().catch(() => {
			this.logger.warn('Initial USB scan failed')
		})

		setImmediate(() => {
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
					for (const device of this.#surfaceHandlers.values()) {
						if (this.#isSurfaceTimedOut(device.deviceId, timeout)) {
							doLockout = true
							this.#surfacesLastInteraction.delete(device.deviceId)
						}
					}

					if (doLockout) {
						this.setAllLocked(true)
					}
				} else {
					for (const device of this.#surfaceHandlers.values()) {
						if (this.#isSurfaceTimedOut(device.deviceId, timeout)) {
							this.#surfacesLastInteraction.delete(device.deviceId)
							this.setDeviceLocked(device.deviceId, true)
						}
					}
				}
			}, 1000)
		}
	}

	/**
	 * Check if a surface should be timed out
	 * @param {string} deviceId
	 * @param {number} timeout
	 * @returns {boolean}
	 */
	#isSurfaceTimedOut(deviceId, timeout) {
		if (!this.isPinLockEnabled()) return false

		const lastInteraction = this.#surfacesLastInteraction.get(deviceId) || 0
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
		const deviceId = panel.info.deviceId

		let isLocked = false
		if (this.isPinLockEnabled()) {
			const timeout = Number(this.userconfig.getKey('pin_timeout')) * 1000
			if (this.userconfig.getKey('link_lockouts')) {
				isLocked = this.#surfacesAllLocked
			} else if (timeout && !isNaN(timeout)) {
				isLocked = this.#isSurfaceTimedOut(deviceId, timeout)
			} else {
				isLocked = !this.#surfacesLastInteraction.has(deviceId)
			}
		}

		const surfaceConfig = this.getDeviceConfig(panel.info.deviceId)
		if (!surfaceConfig) {
			this.logger.silly(`Creating config for newly discovered device ${panel.info.deviceId}`)
		} else {
			this.logger.silly(`Reusing config for device ${panel.info.deviceId}`)
		}

		const handler = new SurfaceHandler(this.registry, integrationType, panel, isLocked, surfaceConfig)
		handler.on('interaction', () => {
			this.#surfacesLastInteraction.set(deviceId, Date.now())
		})
		handler.on('configUpdated', (newConfig) => {
			this.setDeviceConfig(handler.deviceId, newConfig)
		})
		handler.on('unlocked', () => {
			this.#surfacesLastInteraction.set(deviceId, Date.now())

			if (this.userconfig.getKey('link_lockouts')) {
				this.setAllLocked(false)
			}
		})

		this.#surfaceHandlers.set(surfaceId, handler)
		if (!isLocked) {
			// If not already locked, keep it unlocked for the full timeout
			this.#surfacesLastInteraction.set(deviceId, Date.now())
		}
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
			 * @returns {import('./IP/ElgatoEmulator.js').EmulatorConfig}
			 */
			(id) => {
				const fullId = EmulatorRoom(id)

				const instance = this.#surfaceHandlers.get(fullId)
				if (!instance || !(instance.panel instanceof SurfaceIPElgatoEmulator)) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				// Subscribe to the bitmaps
				client.join(fullId)

				return instance.panel.setupClient(client)
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

				const instance = this.#surfaceHandlers.get(fullId)
				if (!instance) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				instance.panel.emit('click', x, y, true)
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

				const instance = this.#surfaceHandlers.get(fullId)
				if (!instance) {
					throw new Error(`Emulator "${id}" does not exist!`)
				}

				instance.panel.emit('click', x, y, false)
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
				for (let instance of this.#surfaceHandlers.values()) {
					if (instance.deviceId == id) {
						instance.setPanelName(name)
						this.updateDevicesList()
					}
				}
			}
		)

		client.onPromise(
			'surfaces:config-get',
			/**
			 * @param {string} id
			 * @returns {[config: unknown, info: unknown] | null}
			 */
			(id) => {
				for (let instance of this.#surfaceHandlers.values()) {
					if (instance.deviceId == id) {
						return instance.getPanelConfig()
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
				for (let instance of this.#surfaceHandlers.values()) {
					if (instance.deviceId == id) {
						instance.setPanelConfig(config)
						return instance.getPanelConfig()
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
				for (let instance of this.#surfaceHandlers.values()) {
					if (instance.deviceId == id) {
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
	 * @returns {ClientDevicesList}
	 */
	getDevicesList() {
		/** @type {AvailableDeviceInfo[]} */
		const availableDevicesInfo = []
		/** @type {OfflineDeviceInfo[]} */
		const offlineDevicesInfo = []

		const config = this.db.getKey('deviceconfig', {})

		const instanceMap = new Map()
		for (const instance of this.#surfaceHandlers.values()) {
			instanceMap.set(instance.deviceId, instance)
		}

		const surfaceIds = Array.from(new Set([...Object.keys(config), ...instanceMap.keys()]))
		for (const id of surfaceIds) {
			const instance = instanceMap.get(id)
			const conf = config[id]

			/** @type {BaseDeviceInfo} */
			const commonInfo = {
				id: id,
				type: conf?.type || 'Unknown',
				integrationType: conf?.integrationType || '',
				name: conf?.name || '',
				index: 0, // Fixed later
			}

			if (instance) {
				let location = instance.panel.info.location
				if (location && location.startsWith('::ffff:')) location = location.substring(7)

				availableDevicesInfo.push({
					...commonInfo,
					location: location || 'Local',
					configFields: instance.panel.info.configFields || [],
				})
			} else {
				offlineDevicesInfo.push({
					...commonInfo,
				})
			}
		}

		/**
		 * @param {BaseDeviceInfo} a
		 * @param {BaseDeviceInfo} b
		 * @returns -1 | 0 | 1
		 */
		function sortDevices(a, b) {
			// emulator must be first
			if (a.id === 'emulator') {
				return -1
			} else if (b.id === 'emulator') {
				return 1
			}

			// sort by type first
			const type = a.type.localeCompare(b.type)
			if (type !== 0) {
				return type
			}

			// then by serial
			return a.id.localeCompare(b.id)
		}
		availableDevicesInfo.sort(sortDevices)
		offlineDevicesInfo.sort(sortDevices)

		/** @type {ClientDevicesList} */
		const res = {
			available: {},
			offline: {},
		}
		availableDevicesInfo.forEach((info, index) => {
			res.available[info.id] = {
				...info,
				index,
			}
		})
		offlineDevicesInfo.forEach((info, index) => {
			res.offline[info.id] = {
				...info,
				index,
			}
		})

		return res
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
										this.logger.log('found loupedeck', deviceInfo)
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
	 * @param {import('./IP/ElgatoPlugin.js').ElgatoPluginClientInfo} clientInfo
	 * @returns
	 */
	addElgatoPluginDevice(devicePath, socket, clientInfo) {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(this.registry, devicePath, socket, clientInfo)

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

	/**
	 * Import a surface configuration
	 * @param {string} deviceId
	 * @param {*} config
	 * @returns {void}
	 */
	importSurface(deviceId, config) {
		const device = this.#getSurfaceHandlerForId(deviceId, true)
		if (device) {
			// Device is currently loaded
			device.setPanelConfig(config)
		} else {
			// Device is not loaded
			this.setDeviceConfig(deviceId, config)
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
		const existingSurface = this.#surfaceHandlers.get(devicePath)
		if (existingSurface) {
			this.logger.silly('remove device ' + devicePath)

			try {
				existingSurface.unload(purge)
			} catch (e) {
				// Ignore for now
			}

			existingSurface.removeAllListeners()

			this.#surfaceHandlers.delete(devicePath)
		}

		this.updateDevicesList()
	}

	quit() {
		for (const device of this.#surfaceHandlers.values()) {
			try {
				device.unload()
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
		for (const dev of Object.values(this.getDevicesList().available)) {
			if (dev.index === index) {
				return dev.id
			}
		}
		return undefined
	}

	/**
	 * Perform page-up for a surface
	 * @param {string} deviceId
	 * @param {boolean} looseIdMatching
	 * @returns {void}
	 */
	devicePageUp(deviceId, looseIdMatching = false) {
		const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
		if (device) {
			device.doPageUp()
		}
	}
	/**
	 * Perform page-down for a surface
	 * @param {string} deviceId
	 * @param {boolean=} looseIdMatching
	 * @returns {void}
	 */
	devicePageDown(deviceId, looseIdMatching = false) {
		const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
		if (device) {
			device.doPageDown()
		}
	}
	/**
	 * Set the page number for a surface
	 * @param {string} deviceId
	 * @param {number} page
	 * @param {boolean=} looseIdMatching
	 * @param {boolean=} defer Defer the drawing to the next tick
	 * @returns {void}
	 */
	devicePageSet(deviceId, page, looseIdMatching = false, defer = false) {
		const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
		if (device) {
			device.setCurrentPage(page, defer)
		}
	}
	/**
	 * Get the page number of a surface
	 * @param {string} deviceId
	 * @param {boolean=} looseIdMatching
	 * @returns {number | undefined}
	 */
	devicePageGet(deviceId, looseIdMatching = false) {
		const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
		if (device) {
			return device.getCurrentPage()
		} else {
			return undefined
		}
	}

	#resetAllDevices() {
		for (const device of this.#surfaceHandlers.values()) {
			try {
				device.resetConfig()
			} catch (e) {
				this.logger.warn('Could not reset a device')
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

		for (const device of this.#surfaceHandlers.values()) {
			this.#surfacesLastInteraction.set(device.deviceId, Date.now())

			device.setLocked(!!locked)
		}
	}

	/**
	 * Set all surfaces as locked
	 * @param {string} deviceId
	 * @param {boolean} locked
	 * @param {boolean} looseIdMatching
	 * @returns {void}
	 */
	setDeviceLocked(deviceId, locked, looseIdMatching = false) {
		if (!this.isPinLockEnabled()) return

		if (this.userconfig.getKey('link_lockouts')) {
			this.setAllLocked(locked)
		} else {
			this.#surfacesAllLocked = false

			// Track the lock/unlock state, even if the device isn't online
			if (locked) {
				this.#surfacesLastInteraction.delete(deviceId)
			} else {
				this.#surfacesLastInteraction.set(deviceId, Date.now())
			}

			const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
			if (device) {
				device.setLocked(!!locked)
			}
		}
	}

	/**
	 * Set the brightness of a surface
	 * @param {string} deviceId
	 * @param {number} brightness 0-100
	 * @param {boolean} looseIdMatching
	 * @returns {void}
	 */
	setDeviceBrightness(deviceId, brightness, looseIdMatching = false) {
		const device = this.#getSurfaceHandlerForId(deviceId, looseIdMatching)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	/**
	 * Get the `SurfaceHandler` for a surfaceId
	 * @param {string} surfaceId
	 * @param {boolean} looseIdMatching Loosely match the id, to handle old device naming
	 * @returns
	 */
	#getSurfaceHandlerForId(surfaceId, looseIdMatching) {
		if (surfaceId === 'emulator') surfaceId = 'emulator:emulator'

		const instances = Array.from(this.#surfaceHandlers.values())

		// try and find exact match
		let device = instances.find((d) => d.deviceId === surfaceId)
		if (device) return device

		// only try more variations if the id isnt new format
		if (!looseIdMatching || surfaceId.includes(':')) return undefined

		// try the most likely streamdeck prefix
		let deviceId2 = `streamdeck:${surfaceId}`
		device = instances.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// it is unlikely, but it could be a loupedeck
		deviceId2 = `loupedeck:${surfaceId}`
		device = instances.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// or maybe a satellite?
		deviceId2 = `satellite-${surfaceId}`
		return instances.find((d) => d.deviceId === deviceId2)
	}
}

export default SurfaceController

/**
 * @typedef {{
 *   id: string
 *   type: string
 *   integrationType: string
 *   name: string
 *   index: number
 * }} BaseDeviceInfo
 *
 * @typedef {BaseDeviceInfo} OfflineDeviceInfo
 *
 * @typedef {{
 *   location: string
 *   configFields: string[]
 * } & BaseDeviceInfo} AvailableDeviceInfo
 *
 * @typedef {{
 *   available: Record<string, AvailableDeviceInfo>
 *   offline: Record<string, OfflineDeviceInfo>
 * }} ClientDevicesList
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

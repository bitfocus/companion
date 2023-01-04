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
import { listLoupedecks, LoupedeckModelId } from '@loupedeck/node'

import SurfaceHandler from './Handler.js'
import SurfaceUSBController from './USB/Controller.js'
import SurfaceIPElgatoEmulator, { EmulatorRoom } from './IP/ElgatoEmulator.js'
import SurfaceIPElgatoPlugin from './IP/ElgatoPlugin.js'
import SurfaceIPSatellite from './IP/Satellite.js'

import CoreBase from '../Core/Base.js'

// Force it to load the hidraw driver just in case
HID.setDriverType('hidraw')
HID.devices()

const SurfacesRoom = 'surfaces'

class SurfaceController extends CoreBase {
	/**
	 * The last sent json object
	 * @access private
	 */
	#lastSentJson = null

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

		this.instances = {}

		// Setup defined emulators
		{
			const instances = this.db.getKey('deviceconfig') || {}
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

		setImmediate(() => {
			this.updateDevicesList()
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
		}
	}

	triggerRefreshDevicesEvent() {
		this.triggerRefreshDevices().catch((e) => {
			this.logger.warn(`Hotplug device refresh failed: ${e}`)
		})
	}

	addEmulator(id, skipUpdate) {
		const fullId = EmulatorRoom(id)
		if (this.instances[fullId]) {
			throw new Error(`Emulator "${id}" already exists!`)
		}

		this.instances[fullId] = new SurfaceHandler(
			this.registry,
			'emulator',
			new SurfaceIPElgatoEmulator(this.registry, id)
		)

		if (!skipUpdate) this.updateDevicesList()
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('emulator:startup', (id) => {
			const fullId = EmulatorRoom(id)

			const instance = this.instances[fullId]
			if (!instance) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			// Subscribe to the bitmaps
			client.join(fullId)

			return instance.panel.setupClient(client)
		})

		client.onPromise('emulator:press', (id, keyIndex) => {
			const fullId = EmulatorRoom(id)

			const instance = this.instances[fullId]
			if (!instance) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			instance.panel.emit('click', keyIndex, true)
		})

		client.onPromise('emulator:release', (id, keyIndex) => {
			const fullId = EmulatorRoom(id)

			const instance = this.instances[fullId]
			if (!instance) {
				throw new Error(`Emulator "${id}" does not exist!`)
			}

			instance.panel.emit('click', keyIndex, false)
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
				return errMsg
			}
		})

		client.onPromise('surfaces:set-name', (id, name) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					instance.setPanelName(name)
					this.updateDevicesList()
				}
			}
		})

		client.onPromise('surfaces:config-get', (id) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					return [instance.getPanelConfig(), instance.getPanelInfo()]
				}
			}
			return null
		})

		client.onPromise('surfaces:config-set', (id, config) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					instance.setPanelConfig(config)
					return instance.getPanelConfig()
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
			if (id.startsWith('emulator:') && this.instances[id]) {
				this.removeDevice(id, true)

				return true
			} else {
				return false
			}
		})

		client.onPromise('surfaces:forget', (id) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
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
	}

	getDevicesList() {
		const availableDevicesInfo = []
		const offlineDevicesInfo = []

		const config = this.db.getKey('deviceconfig', {})

		const instanceMap = new Map()
		for (const instance of Object.values(this.instances)) {
			instanceMap.set(instance.deviceId, instance)
		}

		const surfaceIds = Array.from(new Set([...Object.keys(config), ...instanceMap.keys()]))
		for (const id of surfaceIds) {
			const instance = instanceMap.get(id)
			const conf = config[id]

			const commonInfo = {
				id: id,
				type: conf?.type || 'Unknown',
				integrationType: conf?.integrationType || '',
				name: conf?.name || '',
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
			try {
				const ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled
				const scanForLoupedeck = !!this.userconfig.getKey('loupedeck_enable')

				this.logger.silly('USB: checking devices (blocking call)')

				await Promise.allSettled(
					HID.devices().map(async (deviceInfo) => {
						if (this.instances[deviceInfo.path] === undefined) {
							if (!ignoreStreamDeck) {
								if (getStreamDeckDeviceInfo(deviceInfo)) {
									await this.#addDevice(deviceInfo, 'elgato-streamdeck')
									return
								}
							}

							if (
								deviceInfo.vendorId === 0xffff &&
								(deviceInfo.productId === 0x1f40 || deviceInfo.productId === 0x1f41)
							) {
								await this.#addDevice(deviceInfo, 'infinitton')
							} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
								if (this.userconfig.getKey('xkeys_enable')) {
									await this.#addDevice(deviceInfo, 'xkeys')
								}
							}
						}
					}),
					scanForLoupedeck
						? listLoupedecks().then((deviceInfos) =>
								Promise.allSettled(
									deviceInfos.map(async (deviceInfo) => {
										console.log('found loupedeck', deviceInfo)
										if (this.instances[deviceInfo.path] === undefined) {
											if (
												deviceInfo.model === LoupedeckModelId.LoupedeckLive ||
												deviceInfo.model === LoupedeckModelId.LoupedeckLiveS
											) {
												await this.#addDevice(deviceInfo, 'loupedeck-live', true)
											}
										}
									})
								)
						  )
						: null
				)
				console.log('scanForLoupedeck', scanForLoupedeck)

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

		this.instances[deviceInfo.path] = new SurfaceHandler(this.registry, 'satellite', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	addElgatoPluginDevice(devicePath, socket) {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(this.registry, devicePath, socket)

		this.instances[devicePath] = new SurfaceHandler(this.registry, 'elgato-plugin', device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	async #addDevice(deviceInfo, type, skipHidAccessCheck) {
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
			const dev = await SurfaceUSBController.openDevice(type, deviceInfo.path)
			this.instances[deviceInfo.path] = new SurfaceHandler(this.registry, type, dev)

			setImmediate(() => {
				this.updateDevicesList()
			})
		} catch (e) {
			this.logger.error(`Failed to add "${type}" device: ${e}`)
		}
	}

	removeDevice(devicePath, purge) {
		if (this.instances[devicePath] !== undefined) {
			this.logger.silly('remove device ' + devicePath)

			try {
				this.instances[devicePath].unload(purge)
			} catch (e) {
				// Ignore for now
			}
			delete this.instances[devicePath]
		}

		this.updateDevicesList()
	}

	quit() {
		for (const device of Object.values(this.instances)) {
			try {
				device.unload()
			} catch (e) {
				// Ignore for now
			}
		}

		this.instances = {}
		this.updateDevicesList()
	}

	getDeviceIdFromIndex(index) {
		for (const dev of Object.values(this.getDevicesList().available)) {
			if (dev.index === index) {
				return dev.id
			}
		}
		return undefined
	}

	devicePageUp(deviceId, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			device.doPageUp()
		}
	}
	devicePageDown(deviceId, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			device.doPageDown()
		}
	}
	devicePageSet(deviceId, page, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			device.setCurrentPage(page)
		}
	}
	devicePageGet(deviceId, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			return device.getCurrentPage()
		} else {
			return undefined
		}
	}

	setAllLocked(locked) {
		for (const device of Object.values(this.instances)) {
			device.setLocked(!!locked)
		}
	}

	setDeviceLocked(deviceId, locked, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			device.setLocked(!!locked)
		}
	}

	setDeviceBrightness(deviceId, brightness, looseIdMatching) {
		const device = this.#getDeviceForId(deviceId, looseIdMatching)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	#getDeviceForId(deviceId, looseIdMatching) {
		if (deviceId === 'emulator') deviceId = 'emulator:emulator'

		const instances = Object.values(this.instances)

		// try and find exact match
		let device = instances.find((d) => d.deviceId === deviceId)
		if (device) return device

		// only try more variations if the id isnt new format
		if (!looseIdMatching || deviceId.includes(':')) return undefined

		// try the most likely streamdeck prefix
		let deviceId2 = `streamdeck:${deviceId}`
		device = instances.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// it is unlikely, but it could be a loupedeck
		deviceId2 = `loupedeck:${deviceId}`
		device = instances.find((d) => d.deviceId === deviceId2)
		if (device) return device

		// or maybe a satellite?
		deviceId2 = `satellite-${deviceId}`
		return instances.find((d) => d.deviceId === deviceId2)
	}
}

export default SurfaceController

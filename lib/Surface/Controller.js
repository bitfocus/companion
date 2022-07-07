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
import semver from 'semver'
import os from 'os'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'

import SurfaceHandler from './Handler.js'
import SurfaceUSBController from './USB/Controller.js'
import SurfaceIPElgatoEmulator, { EmulatorRoom } from './IP/ElgatoEmulator.js'
import SurfaceIPElgatoPlugin from './IP/ElgatoPlugin.js'
import SurfaceIPSatellite from './IP/Satellite.js'
import { getStreamDeckDeviceInfo } from '@elgato-stream-deck/node'

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

	constructor(registry) {
		super(registry, 'surfaces', 'Surface/Controller')

		this.instances = {}

		// Setup defined emulators
		{
			const instances = this.db.getKey('deviceconfig')
			for (const id of Object.keys(instances)) {
				// If the id starts with 'emulator:' then re-add it
				if (id.startsWith('emulator:')) {
					this.addEmulator(id.substring(9))
				}
			}
		}

		// Initial search for USB devices
		this.refreshDevices().catch((e) => {
			this.logger.warn('Initial USB scan failed')
		})

		setImmediate(() => {
			this.updateDevicesList()
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
				return this.refreshDevices()
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
	}

	getDevicesList() {
		const res = {}

		const instances = Object.values(this.instances).map((instance) => instance.getDeviceInfo())
		instances.sort((a, b) => {
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
		})

		instances.forEach((info, index) => {
			res[info.id] = {
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

	async refreshDevices() {
		let streamDeckSoftwareRunning = false
		let streamdeckDisabled = !!this.userconfig.getKey('elgato_plugin_enable')

		try {
			// Make sure we don't try to take over stream deck devices when the stream deck application
			// is running on windows.
			if (!streamdeckDisabled && process.platform === 'win32') {
				// findProcess is broken on windows7, so only do the check if newer
				const parsed = semver.parse(os.release())
				if (!parsed || semver.satisfies(parsed, '> 6.2')) {
					const list = await findProcess('name', 'Stream Deck')
					if (typeof list === 'object' && list.length > 0) {
						streamDeckSoftwareRunning = true
						this.logger.silly('Elgato software detected, ignoring stream decks')
					}
				}
			}
		} catch (e) {
			// scan for all usb devices anyways
		}

		try {
			// Now do the scan
			return this.scanUSB(streamDeckSoftwareRunning, streamdeckDisabled)
		} catch (e) {
			this.logger.silly('USB: scan failed ' + e)
			throw 'Scan failed'
		}
	}

	scanUSB(streamDeckSoftwareRunning, streamdeckDisabled) {
		let ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled
		this.logger.silly('USB: checking devices (blocking call)')

		for (const deviceInfo of HID.devices()) {
			if (!ignoreStreamDeck) {
				if (getStreamDeckDeviceInfo(deviceInfo)) {
					if (this.instances[deviceInfo.path] === undefined) {
						this.addDevice(deviceInfo, 'elgato-streamdeck')
					}
					continue
				}
			}
			if (
				deviceInfo.vendorId === 0xffff &&
				deviceInfo.productId === 0x1f40 &&
				this.instances[deviceInfo.path] === undefined
			) {
				this.addDevice(deviceInfo, 'infinitton')
			} else if (
				deviceInfo.vendorId === 0xffff &&
				deviceInfo.productId === 0x1f41 &&
				this.instances[deviceInfo.path] === undefined
			) {
				this.addDevice(deviceInfo, 'infinitton')
			} else if (deviceInfo.vendorId === 1523 && deviceInfo.interface === 0) {
				if (this.userconfig.getKey('xkeys_enable')) {
					this.addDevice(deviceInfo, 'xkeys')
				}
			}
		}
		this.logger.silly('USB: done')

		if (streamdeckDisabled) {
			return 'Ignoring Stream Decks devices as the plugin has been enabled'
		} else if (ignoreStreamDeck) {
			return 'Ignoring Stream Decks devices as the stream deck app is running'
		} else {
			return undefined
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

	addDevice(deviceInfo, type) {
		this.removeDevice(deviceInfo.path)

		this.logger.silly('add device ' + deviceInfo.path)

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

		new SurfaceUSBController(type, deviceInfo.path, (dev) => {
			this.logger.silly('initializing SurfaceHandler')
			this.instances[deviceInfo.path] = new SurfaceHandler(this.registry, type, dev)

			setImmediate(() => {
				this.updateDevicesList()
			})
		})
	}

	removeDevice(deviceId, purge) {
		if (this.instances[deviceId] !== undefined) {
			this.logger.silly('remove device ' + deviceId)

			try {
				this.instances[deviceId].unload(purge)
			} catch (e) {
				// Ignore for now
			}
			delete this.instances[deviceId]
		}

		this.updateDevicesList()
	}

	quit() {
		for (let deviceId in this.instances) {
			try {
				this.removeDevice(deviceId)
			} catch (e) {}
		}
	}

	getDeviceIdFromIndex(index) {
		for (const dev of Object.values(this.getDevicesList())) {
			if (dev.index === index) {
				return dev.id
			}
		}
		return undefined
	}

	devicePageUp(deviceId) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.doPageUp()
		}
	}
	devicePageDown(deviceId) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.doPageDown()
		}
	}
	devicePageSet(deviceId, page) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setCurrentPage(page)
		}
	}
	devicePageGet(deviceId) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
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

	setDeviceLocked(deviceId, locked) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setLocked(!!locked)
		}
	}

	setDeviceBrightness(deviceId, brightness) {
		deviceId = this.fixupDeviceId(deviceId)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setBrightness(brightness)
		}
	}

	fixupDeviceId(deviceId) {
		if (deviceId === 'emulator') return 'emulator:emulator'
		return deviceId
	}
}

export default SurfaceController

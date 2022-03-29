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

import SurfaceHandler from './Handler.js'
import SurfaceUSBController from './USB/Controller.js'
import SurfaceIPElgatoEmulator from './IP/ElgatoEmulator.js'
import SurfaceIPElgatoPlugin from './IP/ElgatoPlugin.js'
import SurfaceIPSatellite from './IP/Satellite.js'
import { getStreamDeckDeviceInfo } from '@elgato-stream-deck/node'

import CoreBase from '../Core/Base.js'

class SurfaceController extends CoreBase {
	constructor(registry) {
		super(registry, 'surfaces', 'lib/Surface/Controller')

		this.instances = {}
		this.surface_names = this.db.getKey('surface_names', {})

		// Add emulator by default
		this.instances['emulator'] = new SurfaceHandler(
			this.registry,
			new SurfaceIPElgatoEmulator(this.registry, 'emulator')
		)

		// Initial search for USB devices
		this.refreshDevices()
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		try {
			this.instances['emulator'].panel.clientConnect(client)
		} catch (e) {
			this.debug("couldn't setup client socket with emulator")
		}

		client.on('devices_list_get', () => {
			this.updateDevicesList(client)
		})

		client.on('devices_reenumerate', (answer) => {
			this.refreshDevices((errMsg) => {
				answer(errMsg)
			})
		})

		client.on('device_set_name', (id, name) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					instance.setPanelName(name)
					this.updateDevicesList()
				}
			}
		})

		client.on('device_config_get', (id, answer) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					answer(null, instance.getPanelConfig(), instance.getPanelInfo())
					return
				}
			}
			answer('device not found')
		})

		client.on('device_config_set', (id, config, answer) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.deviceId == id) {
					instance.setPanelConfig(config)
					answer(null, instance.getPanelConfig())
					return
				}
			}
			answer('device not found')
		})
	}

	getDevicesList() {
		const ary = Object.values(this.instances).map((instance) => instance.getDeviceInfo())

		ary.sort((a, b) => {
			// emulator must be first
			if (a.id == 'emulator') {
				return -1
			} else if (b.id == 'emulator') {
				return 1
			}

			// sort by type first
			const type = a.type.localeCompare(b.type)
			if (type !== 0) {
				return type
			}

			// then by the id
			return a.id.localeCompare(b.id)
		})

		return ary
	}

	updateDevicesList(socket) {
		const ary = this.getDevicesList()

		// notify the internal module
		this.system.emit('devices_list', ary)

		if (socket !== undefined) {
			socket.emit('devices_list', ary)
		} else {
			this.io.emit('devices_list', ary)
		}
	}

	refreshDevices(cb) {
		let streamDeckSoftwareRunning = false
		let streamdeckDisabled = !!this.userconfig.getKey('elgato_plugin_enable')

		try {
			// Make sure we don't try to take over stream deck devices when the stream deck application
			// is running on windows.
			if (!streamdeckDisabled && process.platform === 'win32') {
				findProcess('name', 'Stream Deck')
					.then((list) => {
						if (typeof list === 'object' && list.length > 0) {
							streamDeckSoftwareRunning = true
							this.debug('Elgato software detected, ignoring stream decks')
						}

						this.scanUSB(streamDeckSoftwareRunning, streamdeckDisabled)
					})
					.catch((err) => {
						// ignore
						this.scanUSB(streamDeckSoftwareRunning, streamdeckDisabled)
					})
			} else {
				// ignore
				this.scanUSB(streamDeckSoftwareRunning, streamdeckDisabled)
			}
		} catch (e) {
			try {
				// scan for all usb devices anyways
				this.scanUSB(streamDeckSoftwareRunning, streamdeckDisabled)
			} catch (e) {
				this.debug('USB: scan failed ' + e)
				if (typeof cb === 'function') {
					cb('Scan failed')
				}
			}
		}
	}

	scanUSB(streamDeckSoftwareRunning, streamdeckDisabled) {
		let ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled
		this.debug('USB: checking devices (blocking call)')

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
		this.debug('USB: done')

		if (typeof cb === 'function') {
			if (streamdeckDisabled) {
				cb('Ignoring Stream Decks devices as the plugin has been enabled')
			} else if (ignoreStreamDeck) {
				cb('Ignoring Stream Decks devices as the stream deck app is running')
			} else {
				cb()
			}
		}
	}

	addSatelliteDevice(deviceInfo) {
		this.removeDevice(deviceInfo.path)

		const device = new SurfaceIPSatellite(deviceInfo)

		this.instances[deviceInfo.path] = new SurfaceHandler(this.registry, device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	addElgatoPluginDevice(devicePath, socket) {
		this.removeDevice(devicePath)

		const device = new SurfaceIPElgatoPlugin(this.registry, devicePath, socket)

		this.instances[devicePath] = new SurfaceHandler(this.registry, device)

		setImmediate(() => {
			this.updateDevicesList()
		})

		return device
	}

	addDevice(deviceInfo, type) {
		this.removeDevice(deviceInfo.path)

		this.debug('add device ' + deviceInfo.path)

		// Check if we have access to the device
		try {
			const devicetest = new HID.HID(deviceInfo.path)
			devicetest.close()
		} catch (e) {
			this.system.emit(
				'log',
				'USB(' + type + ')',
				'error',
				'Found device, but no access. Please quit any other applications using the device, and try again.'
			)
			this.debug('device in use, aborting')
			return
		}

		new SurfaceUSBController(this.system, type, deviceInfo.path, (dev) => {
			this.debug('initializing SurfaceHandler')
			this.instances[deviceInfo.path] = new SurfaceHandler(this.registry, dev)

			setImmediate(() => {
				this.updateDevicesList()
			})
		})
	}

	removeDevice(deviceId, skipNotify) {
		if (this.instances[deviceId] !== undefined) {
			this.debug('remove device ' + deviceId)

			try {
				this.instances[deviceId].unload()
			} catch (e) {
				// Ignore for now
			}
			delete this.instances[deviceId]
		}

		if (!skipNotify) {
			this.updateDevicesList()
		}
	}

	quit() {
		for (let deviceId in this.instances) {
			try {
				this.removeDevice(deviceId)
			} catch (e) {}
		}
	}

	devicePageUp(deviceId) {
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.doPageUp()
		}
	}
	devicePageDown(deviceId) {
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.doPageDown()
		}
	}
	devicePageSet(deviceId, page) {
		// Before: this.system.on('device_page_set', this.....)

		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setCurrentPage(page)
		}
	}
	devicePageGet(deviceId) {
		// Before: this.system.on('device_page_get', this.....)

		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			return device.getCurrentPage()
		} else {
			return undefined
		}
	}

	setAllLocked(locked) {
		// Before: this.system.on('lockoutall', this.lockoutAll)
		// this.system.on('unlockoutall', this.unlockoutAll)
		for (const device of Object.values(this.instances)) {
			device.setLocked(!!locked)
		}
	}

	setDeviceLocked(deviceId, locked) {
		// Before: this.system.on('lockout_device', this.lockoutDevice)
		// this.system.on('unlockout_device', this.unlockoutDevice)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setLocked(!!locked)
		}
	}

	setDeviceBrightness(deviceId, brightness) {
		// Before: this.system.on('device_brightness_set', this.onDeviceBrightnessSet)
		const device = Object.values(this.instances).find((d) => d.deviceId === deviceId)
		if (device) {
			device.setBrightness(brightness)
		}
	}
}

export default SurfaceController

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

const findProcess = require('find-process')
const HID = require('node-hid')

const SurfaceHandler = require('./Handler')
const SurfaceUSBController = require('./USB/Controller')
const SurfaceIPElgatoEmulator = require('./IP/ElgatoEmulator')
const SurfaceIPElgatoPlugin = require('./IP/ElgatoPlugin')
const SurfaceIPSatellite = require('./IP/Satellite')
const { getStreamDeckDeviceInfo } = require('@elgato-stream-deck/node')

const CoreBase = require('../Core/Base')

class SurfaceController extends CoreBase {
	constructor(registry) {
		super(registry, 'surfaces', 'lib/Surface/Controller')

		this.instances = {}
		this.surface_names = this.db.getKey('surface_names', {})

		this.system.on('elgatodm_remove_device', this.removeDevice.bind(this))

		// Add emulator by default
		this.addDevice({ path: 'emulator' }, 'elgatoEmulator')

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

		client.on('device_set_name', (serialnumber, name) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.panel.serialnumber == serialnumber) {
					instance.setPanelName(name)
					this.updateDevicesList()
				}
			}
		})

		client.on('device_config_get', (_id, answer) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.panel.id == _id) {
					answer(null, instance.getPanelConfig(), instance.getPanelInfo())
					return
				}
			}
			answer('device not found')
		})

		client.on('device_config_set', (_id, config, answer) => {
			for (let instance of Object.values(this.instances)) {
				if (instance.panel.id == _id) {
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

			// then by serial
			return a.serialnumber.localeCompare(b.serialnumber)
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

		for (const device of HID.devices()) {
			if (!ignoreStreamDeck) {
				if (getStreamDeckDeviceInfo(device)) {
					if (this.instances[device.path] === undefined) {
						this.addDevice(device, 'elgato-streamdeck')
					}
					continue
				}
			}
			if (device.vendorId === 0xffff && device.productId === 0x1f40 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'infinitton')
			} else if (
				device.vendorId === 0xffff &&
				device.productId === 0x1f41 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'infinitton')
			} else if (device.vendorId === 1523 && device.interface === 0) {
				if (this.userconfig.getKey('xkeys_enable')) {
					this.addDevice(device, 'xkeys')
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

	addDevice(device, type) {
		this.debug('add device ' + device.path)

		if (this.instances[device.path] !== undefined) {
			this.instances[device.path].unload()
			delete this.instances[device.path]
		}

		if (type === 'elgatoEmulator') {
			this.instances[device.path] = new SurfaceHandler(
				this.registry,
				new SurfaceIPElgatoEmulator(this.registry, device.path)
			)

			this.updateDevicesList()
		} else if (type === 'streamdeck_plugin') {
			this.instances[device.path] = new SurfaceHandler(
				this.registry,
				new SurfaceIPElgatoPlugin(this.system, device.path)
			)

			this.updateDevicesList()
		} else if (type === 'satellite_device2') {
			this.instances[device.path] = new SurfaceHandler(this.registry, new SurfaceIPSatellite(this.system, device))

			this.updateDevicesList()
		} else {
			// Check if we have access to the device
			try {
				const devicetest = new HID.HID(device.path)
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

			new SurfaceUSBController(this.system, type, device.path, (dev) => {
				this.debug('initializing SurfaceHandler')
				this.instances[device.path] = new SurfaceHandler(this.registry, dev)

				this.updateDevicesList()
			})
		}
	}

	removeDevice(devicepath) {
		this.debug('remove device ' + devicepath)
		if (this.instances[devicepath] !== undefined) {
			this.instances[devicepath].unload()
			delete this.instances[devicepath]
		}

		this.updateDevicesList()
	}

	quit() {
		for (let devicepath in this.instances) {
			try {
				this.removeDevice(devicepath)
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
			device.doSetPage(page)
		}
	}
}

module.exports = SurfaceController

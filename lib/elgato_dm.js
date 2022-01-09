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

const deviceHandler = require('./device')
const findProcess = require('find-process')
const HID = require('node-hid')
const usb = require('./usb')
const elgatoEmulator = require('./elgato_emulator')
const elgatoPluginDevice = require('./elgato_plugin')
const satelliteDeviceLegacy = require('./satellite/satellite_device_legacy')
const satelliteDevice = require('./satellite/satellite_device')

HID.setDriverType('libusb')

class elgatoDM {
	debug = require('debug')('lib/elgato_dm')

	constructor(system) {
		this.system = system
		this.debug('module required')

		this.instances = {}
		this.surface_names = {}

		this.system.emit('db_get', 'surfaces_names', (names) => {
			if (names) {
				this.surface_names = names
			}
		})

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj
		})

		this.system.on('elgatodm_get', (cb) => {
			if (typeof cb == 'function') {
				cb(this)
			}
		})

		this.system.on('elgatodm_remove_device', this.removeDevice.bind(this))

		this.system.on('devices_reenumerate', () => {
			this.refreshDevices()
		})

		this.system.on('devices_list_get', (cb) => {
			// For the intenal module
			cb(this.getDevicesList())
		})

		this.system.emit('io_get', (io) => {
			this.io = io

			this.system.on('io_connect', (socket) => {
				socket.on('devices_list_get', () => {
					this.updateDevicesList(socket)
				})

				socket.on('devices_reenumerate', (answer) => {
					this.refreshDevices((errMsg) => {
						answer(errMsg)
					})
				})

				socket.on('device_set_name', (serialnumber, name) => {
					for (let instance of Object.values(this.instances)) {
						if (instance.panel.serialnumber == serialnumber) {
							instance.setPanelName(name)
							this.updateDevicesList()
						}
					}
				})

				socket.on('device_config_get', (_id, answer) => {
					for (let instance of Object.values(this.instances)) {
						if (instance.panel.id == _id) {
							answer(null, instance.getPanelConfig(), instance.getPanelInfo())
							return
						}
					}
					answer('device not found')
				})

				socket.on('device_config_set', (_id, config, answer) => {
					for (let instance of Object.values(this.instances)) {
						if (instance.panel.id == _id) {
							instance.setPanelConfig(config)
							answer(null, instance.getPanelConfig())
							return
						}
					}
					answer('device not found')
				})
			})
		})

		// Add emulator by default
		this.addDevice({ path: 'emulator' }, 'elgatoEmulator')

		// Initial search for USB devices
		this.refreshDevices()
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
		let ignoreStreamDeck = false

		try {
			if (process.platform === 'win32') {
				findProcess('name', 'Stream Deck')
					.then((list) => {
						if (typeof list === 'object' && list.length > 0) {
							ignoreStreamDeck = true
							this.debug(
								'Not scanning for Stream Deck devices because we are on windows, and the stream deck app is running'
							)
						}

						this.scanUSB(ignoreStreamDeck)
					})
					.catch((err) => {
						// ignore
						this.scanUSB(ignoreStreamDeck)
					})
			} else {
				// ignore
				this.scanUSB(ignoreStreamDeck)
			}
		} catch (e) {
			try {
				// scan for all usb devices anyways
				this.scanUSB(ignoreStreamDeck)
			} catch (e) {
				this.debug('USB: scan failed ' + e)
				if (typeof cb === 'function') {
					cb('Scan failed')
				}
			}
		}
	}

	scanUSB(ignoreStreamDeck) {
		this.debug('USB: checking devices (blocking call)')
		const devices = HID.devices()
		for (const device of devices) {
			if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0060 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'elgato')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0063 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'elgato-mini')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006c &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'elgato-xl')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006d &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'elgato-v2')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0080 &&
				this.instances[device.path] === undefined
			) {
				// technically elgato-mk2, but its the same protocol
				this.addDevice(device, 'elgato-v2')
			} else if (
				device.vendorId === 0xffff &&
				device.productId === 0x1f40 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'infinitton')
			} else if (
				device.vendorId === 0xffff &&
				device.productId === 0x1f41 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'infinitton')
			} else if (device.vendorId === 1523 && device.interface === 0) {
				if (this.config.xkeys_enable) {
					this.addDevice(device, 'xkeys')
				}
			}
		}
		this.debug('USB: done')

		if (typeof cb === 'function') {
			if (ignoreStreamDeck) {
				cb('Not scanning for Stream Deck devices as the stream deck app is running')
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
			this.instances[device.path] = new deviceHandler(this.system, new elgatoEmulator(this.system, device.path))

			this.updateDevicesList()
		} else if (type === 'streamdeck_plugin') {
			this.instances[device.path] = new deviceHandler(this.system, new elgatoPluginDevice(this.system, device.path))

			this.updateDevicesList()
		} else if (type === 'satellite_device') {
			this.instances[device.path] = new deviceHandler(
				this.system,
				new satelliteDeviceLegacy(this.system, device.path, device)
			)

			this.updateDevicesList()
		} else if (type === 'satellite_device2') {
			this.instances[device.path] = new deviceHandler(this.system, new satelliteDevice(this.system, device))

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

			new usb(this.system, type, device.path, (dev) => {
				this.debug('initializing deviceHandler')
				this.instances[device.path] = new deviceHandler(this.system, dev)

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
}

exports = module.exports = function (system) {
	return new elgatoDM(system)
}

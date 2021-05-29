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

const debug = require('debug')('Device/Controller')
const CoreBase = require('../Core/Base')
const HID = require('node-hid')
const findProcess = require('find-process')

const DeviceHandler = require('./Handler')
const DeviceHardwareController = require('./Hardware/Controller')
const DeviceSoftwareElgatoEmulator = require('./Software/ElgatoEmulator')
const DeviceSoftwareElgatoPlugin = require('./Software/ElgatoPlugin')
const DeviceSoftwareSatellite = require('./Software/Satellite')

HID.setDriverType('libusb')

class DeviceController extends CoreBase {
	constructor(registry) {
		super(registry, 'device-manager')

		this.instances = {}

		this.system.on('device_remove', this.removeDevice.bind(this))

		this.system.on('devices_list_get', (cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getList())
			}
		})

		this.system.on('devices_reenumerate', () => {
			this.refreshDevices()
		})

		this.system.on('io_connect', (client) => {
			client.on('devices_list_get', () => {
				this.updateDevicesList(client)
			})

			client.on('devices_reenumerate', (answer) => {
				this.refreshDevices((errMsg) => {
					answer(errMsg)
				})
			})

			client.on('device_config_get', (_id, answer) => {
				for (var id in this.instances) {
					if (this.instances[id].id == _id) {
						this.instances[id].getConfig((result) => {
							answer(null, result)
						})
						return
					}
				}
				answer('device not found')
			})

			client.on('device_config_set', (_id, config) => {
				for (var id in this.instances) {
					if (this.instances[id].id == _id) {
						this.instances[id].setConfig(config)
						return
					}
				}
			})
		})

		// Add emulator by default
		this.addDevice({ path: 'emulator' }, 'DeviceSoftwareElgatoEmulator')

		// Initial search for USB devices
		this.refreshDevices()
	}

	addDevice(device, type) {
		debug('add device ' + device.path)

		if (this.instances[device.path] !== undefined) {
			try {
				this.instances[device.path].quit()
			} catch (e) {}

			this.instances[device.path].deviceHandler.unload()

			delete this.instances[device.path].deviceHandler
			delete this.instances[device.path]
		}

		if (type === 'DeviceSoftwareElgatoEmulator') {
			this.instances[device.path] = new DeviceSoftwareElgatoEmulator(this.system, device.path)
			this.instances[device.path].deviceHandler = new DeviceHandler(this.registry, this.instances[device.path])

			this.updateDevicesList()
		} else if (type === 'DeviceSoftwareElgatoPlugin') {
			this.instances[device.path] = new DeviceSoftwareElgatoPlugin(this.system, device.path)
			this.instances[device.path].deviceHandler = new DeviceHandler(this.registry, this.instances[device.path])

			this.updateDevicesList()
		} else if (type === 'DeviceSoftwareSatellite') {
			this.instances[device.path] = new DeviceSoftwareSatellite(this.system, device.path, device)
			this.instances[device.path].deviceHandler = new DeviceHandler(this.registry, this.instances[device.path])

			this.updateDevicesList()
		} else {
			// Check if we have access to the device
			try {
				var devicetest = new HID.HID(device.path)
				devicetest.close()
			} catch (e) {
				this.system.emit(
					'log',
					'USB(' + type.deviceType + ')',
					'error',
					'Found device, but no access. Please quit any other applications using the device, and try again.'
				)
				debug('device in use, aborting')
				return
			}

			this.instances[device.path] = new DeviceHardwareController(this.system, type, device.path, () => {
				debug('initializing deviceHandler')
				this.instances[device.path].deviceHandler = new DeviceHandler(this.registry, this.instances[device.path])

				this.updateDevicesList()
			})
		}
	}

	getList() {
		var ary = []
		var keys = Object.keys(this.instances)

		if (keys[0] != undefined) {
			ary.push({
				id: this.instances[keys[0]].id,
				serialnumber: this.instances[keys[0]].serialnumber,
				type: this.instances[keys[0]].type,
				config: this.instances[keys[0]].config,
			})
		}

		var item = 1

		while (item < keys.length) {
			if (this.instances[keys[item]].type === 'emulator') {
				ary.splice(0, 0, {
					id: this.instances[keys[item]].id,
					serialnumber: this.instances[keys[item]].serialnumber,
					type: this.instances[keys[item]].type,
					config: this.instances[keys[item]].config,
				})
			} else {
				var i = 0

				while (
					ary[i] !== undefined &&
					(ary[i].id == 'emulator' ||
						ary[i].type < this.instances[keys[item]].type ||
						(ary[i].type == this.instances[keys[item]].type &&
							ary[i].serialnumber < this.instances[keys[item]].serialnumber))
				) {
					i++
				}

				ary.splice(i, 0, {
					id: this.instances[keys[item]].id,
					serialnumber: this.instances[keys[item]].serialnumber,
					type: this.instances[keys[item]].type,
					config: this.instances[keys[item]].config,
				})
			}

			item++
		}

		return ary
	}

	quit() {
		for (var devicepath in this.instances) {
			try {
				this.removeDevice(devicepath)
			} catch (e) {}
		}
	}

	refreshDevices(cb) {
		var ignoreStreamDeck = false

		// Make sure we don't try to take over stream deck devices when the stream deck application
		// is running on windows.
		ignoreStreamDeck = false

		try {
			if (process.platform === 'win32') {
				findProcess('name', 'Stream Deck')
					.then((list) => {
						if (typeof list === 'object' && list.length > 0) {
							ignoreStreamDeck = true
							debug(
								'Not scanning for Stream Deck devices because we are on windows, and the stream deck app is running'
							)
						}

						this.scanUSB(ignoreStreamDeck, cb)
					})
					.catch((err) => {
						// ignore
						this.scanUSB(ignoreStreamDeck, cb)
					})
			} else {
				// ignore
				this.scanUSB(ignoreStreamDeck, cb)
			}
		} catch (e) {
			try {
				// scan for all usb devices anyways
				this.scanUSB(ignoreStreamDeck, cb)
			} catch (e) {
				debug('USB: scan failed' + e)

				if (typeof cb === 'function') {
					cb('Scan failed')
				}
			}
		}
	}

	removeDevice(devicepath) {
		debug('remove device ' + devicepath)

		if (this.instances[devicepath] !== undefined) {
			try {
				this.instances[devicepath].quit()
			} catch (e) {}
			this.instances[devicepath].deviceHandler.unload()

			delete this.instances[devicepath].deviceHandler
			delete this.instances[devicepath]
		}

		this.updateDevicesList()
	}

	scanUSB(ignoreStreamDeck, cb) {
		debug('USB: checking devices (blocking call)')
		var devices = HID.devices()

		for (var i = 0; i < devices.length; ++i) {
			let device = devices[i]

			if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0060 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareElgato')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0063 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareElgatoMini')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006c &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareElgatoXL')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006d &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareElgato')
			} else if (
				device.vendorId === 0xffff &&
				device.productId === 0x1f40 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareInfinitton')
			} else if (
				device.vendorId === 0xffff &&
				device.productId === 0x1f41 &&
				this.instances[device.path] === undefined
			) {
				this.addDevice(device, 'DeviceHardwareInfinitton')
			} else if (device.vendorId === 1523 && device.interface === 0) {
				this.addDevice(device, 'xkeys')
			}
		}

		debug('USB: done')

		if (typeof cb === 'function') {
			if (ignoreStreamDeck) {
				cb('Not scanning for Stream Deck devices as the stream deck app is running')
			} else {
				cb()
			}
		}
	}

	updateDevicesList(socket) {
		var ary = this.getList()

		this.system.emit('devices_list', ary)

		if (socket !== undefined) {
			socket.emit('devices_list', ary)
		} else {
			if (this.io() !== undefined) {
				this.io.emit('devices_list', ary)
			}
		}
	}
}

exports = module.exports = DeviceController

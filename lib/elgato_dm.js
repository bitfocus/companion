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

var debug = require('debug')('lib/elgato_dm')
var HID = require('node-hid')
var findProcess = require('find-process')
var deviceHandler = require('./device')
var usb = require('./usb')
var elgatoEmulator = require('./elgato_emulator')
var elgatoPluginDevice = require('./elgato_plugin')
var satelliteDeviceLegacy = require('./satellite/satellite_device_legacy')
var satelliteDevice = require('./satellite/satellite_device')

HID.setDriverType('libusb')

debug('module required')

var instances = {}

function elgatoDM(system) {
	var self = this
	self.system = system

	self.surface_names = {}

	system.emit('db_get', 'surfaces_names', function (names) {
		if (names) {
			self.surface_names = names
		}
	})

	system.emit('get_userconfig', function (obj) {
		self.config = obj
	})

	system.emit('get_userconfig', function (userconfig) {
		for (let key in userconfig) {
			if (key.substring(0, 7) == 'rescan_' || key.substring(0, 6) == 'xkeys_') {
				self.config[key] = userconfig[key]
			}
		}

		self.setupRescanInterval()
	})

	system.on('set_userconfig_key', function (key, value) {
		if (key.substring(0, 7) == 'rescan_' || key.substring(0, 6) == 'xkeys_') {
			self.config[key] = value

			if (key.substring(0, 7) == 'rescan_') {
				self.setupRescanInterval()
			}
		}
	})

	system.on('elgatodm_remove_device', self.removeDevice.bind(self))

	system.on('devices_reenumerate', function () {
		self.refreshDevices()
	})

	system.on('devices_list_get', function (cb) {
		// For the intenal module
		cb(self.getDevicesList())
	})

	system.emit('io_get', function (io) {
		self.io = io

		system.on('io_connect', function (socket) {
			socket.on('devices_list_get', function () {
				self.updateDevicesList(socket)
			})

			socket.on('devices_reenumerate', function (answer) {
				self.refreshDevices(function (errMsg) {
					answer(errMsg)
				})
			})

			socket.on('device_set_name', function (serialnumber, name) {
				for (var instance of Object.values(instances)) {
					if (instance.panel.serialnumber == serialnumber) {
						instance.setPanelName(name)
						self.updateDevicesList()
					}
				}
			})

			socket.on('device_config_get', function (_id, answer) {
				for (var instance of Object.values(instances)) {
					if (instance.panel.id == _id) {
						answer(null, instance.getPanelConfig(), instance.getPanelInfo())
						return
					}
				}
				answer('device not found')
			})

			socket.on('device_config_set', function (_id, config, answer) {
				for (var instance of Object.values(instances)) {
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
	self.addDevice({ path: 'emulator' }, 'elgatoEmulator')

	// Initial search for USB devices
	self.refreshDevices()
}

elgatoDM.prototype.getDevicesList = function () {
	var self = this

	const ary = Object.values(instances).map((instance) => instance.getDeviceInfo())

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

elgatoDM.prototype.updateDevicesList = function (socket) {
	const self = this

	const ary = self.getDevicesList()

	// notify the internal module
	self.system.emit('devices_list', ary)

	if (socket !== undefined) {
		socket.emit('devices_list', ary)
	} else {
		self.io.emit('devices_list', ary)
	}
}

elgatoDM.prototype.refreshDevices = function (cb) {
	var self = this
	var ignoreStreamDeck = false

	function scanUSB() {
		debug('USB: checking devices (blocking call)')
		var devices = HID.devices()
		for (const device of devices) {
			if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0060 &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0063 &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato-mini')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006c &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato-xl')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x006d &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato-v2')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0080 &&
				instances[device.path] === undefined
			) {
				// technically elgato-mk2, but its the same protocol
				self.addDevice(device, 'elgato-v2')
			} else if (device.vendorId === 0xffff && device.productId === 0x1f40 && instances[device.path] === undefined) {
				self.addDevice(device, 'infinitton')
			} else if (device.vendorId === 0xffff && device.productId === 0x1f41 && instances[device.path] === undefined) {
				self.addDevice(device, 'infinitton')
			} else if (device.vendorId === 1523 && device.interface === 0) {
				if (self.config.xkeys_enable) {
					self.addDevice(device, 'xkeys')
				}
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

	// Make sure we don't try to take over stream deck devices when the stream deck application
	// is running on windows.
	ignoreStreamDeck = false

	try {
		if (process.platform === 'win32') {
			findProcess('name', 'Stream Deck')
				.then(function (list) {
					if (typeof list === 'object' && list.length > 0) {
						ignoreStreamDeck = true
						debug('Not scanning for Stream Deck devices because we are on windows, and the stream deck app is running')
					}

					scanUSB()
				})
				.catch(function (err) {
					// ignore
					scanUSB()
				})
		} else {
			// ignore
			scanUSB()
		}
	} catch (e) {
		try {
			// scan for all usb devices anyways
			scanUSB()
		} catch (e) {
			debug('USB: scan failed ' + e)
			if (typeof cb === 'function') {
				cb('Scan failed')
			}
		}
	}
}

elgatoDM.prototype.addDevice = function (device, type) {
	var self = this
	debug('add device ' + device.path)

	if (instances[device.path] !== undefined) {
		instances[device.path].unload()
		delete instances[device.path]
	}

	if (type === 'elgatoEmulator') {
		instances[device.path] = new deviceHandler(self.system, new elgatoEmulator(self.system, device.path))

		self.updateDevicesList()
	} else if (type === 'streamdeck_plugin') {
		instances[device.path] = new deviceHandler(self.system, new elgatoPluginDevice(self.system, device.path))

		self.updateDevicesList()
	} else if (type === 'satellite_device') {
		instances[device.path] = new deviceHandler(self.system, new satelliteDeviceLegacy(self.system, device.path, device))

		self.updateDevicesList()
	} else if (type === 'satellite_device2') {
		instances[device.path] = new deviceHandler(self.system, new satelliteDevice(self.system, device))

		self.updateDevicesList()
	} else {
		// Check if we have access to the device
		try {
			var devicetest = new HID.HID(device.path)
			devicetest.close()
		} catch (e) {
			self.system.emit(
				'log',
				'USB(' + type + ')',
				'error',
				'Found device, but no access. Please quit any other applications using the device, and try again.'
			)
			debug('device in use, aborting')
			return
		}

		new usb(self.system, type, device.path, function (dev) {
			debug('initializing deviceHandler')
			instances[device.path] = new deviceHandler(self.system, dev)

			self.updateDevicesList()
		})
	}
}

elgatoDM.prototype.removeDevice = function (devicepath) {
	var self = this
	debug('remove device ' + devicepath)
	if (instances[devicepath] !== undefined) {
		instances[devicepath].unload()
		delete instances[devicepath]
	}

	self.updateDevicesList()
}

elgatoDM.prototype.quit = function () {
	var self = this

	for (var devicepath in instances) {
		try {
			self.removeDevice(devicepath)
		} catch (e) {}
	}
}

elgatoDM.prototype.setupRescanInterval = function () {
	var self = this

	if (self.rescanInterval !== undefined) {
		clearInterval(self.rescanInterval)
	}

	if (self.config.rescan_enabled === true && self.config.rescan_interval > 0) {
		self.rescanInterval = setInterval(function () {
			self.system.emit('log', 'elgatoDM', 'debug', 'Running periodic USB rescan')
			debug('Running periodic USB rescan')
			self.refreshDevices()
		}, self.config.rescan_interval * 1000)
	}
}

// Simple singleton
var instance
exports = module.exports = function (system) {
	if (instance === undefined) {
		instance = new elgatoDM(system)
	}
	return instance
}

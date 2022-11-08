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
var loupedeck = require('@loupedeck/node')
var findProcess = require('find-process')
var deviceHandler = require('./device')
var usb = require('./usb')
var elgatoEmulator = require('./elgato_emulator_device')
var elgatoPluginDevice = require('./elgato_plugin_device')
var satelliteDeviceLegacy = require('./satellite/satellite_device_legacy')
var satelliteDevice = require('./satellite/satellite_device')
var semver = require('semver')
var os = require('os')
var jsonPatch = require('fast-json-patch')
var system

if (process.env.COMPANION_USE_HIDRAW && process.platform === 'linux') {
	HID.setDriverType('hidraw')
	// Force it to load just in case
	HID.devices()
} else {
	HID.setDriverType('libusb')
}

debug('module required')

var instances = {}

function elgatoDM(_system) {
	var self = this
	system = _system

	self.surface_names = {}

	self.last_devices_list = {}

	system.emit('db_get', 'surfaces_names', function (names) {
		if (names) {
			self.surface_names = names
		}
	})

	system.emit('get_userconfig', function (obj) {
		self.config = obj
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
				socket.emit('devices_list', self.last_devices_list)
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

	setImmediate(() => {
		this.updateDevicesList()
	})
}

elgatoDM.prototype.getDevicesList = function () {
	var self = this

	const res = {}

	for (const instance of Object.values(instances)) {
		const info = instance.getDeviceInfo()
		res[info.id] = info
	}

	return res
}

elgatoDM.prototype.updateDevicesList = function () {
	const self = this

	const info = self.getDevicesList()

	const patch = jsonPatch.compare(self.last_devices_list || {}, info || {})
	if (patch.length > 0) {
		self.last_devices_list = info
		self.io.emit('devices_list', patch)
	}
}

elgatoDM.prototype.refreshDevices = function (cb) {
	var self = this
	var streamDeckSoftwareRunning = false
	var streamdeckDisabled = !!self.config.elgato_plugin_enable

	var ignoreStreamDeck = streamDeckSoftwareRunning || streamdeckDisabled

	function completeScan(error) {
		if (error) debug('USB: scan failed ' + e)

		if (typeof cb === 'function') {
			if (error) {
				cb('Scan failed')
			} else {
				if (streamdeckDisabled) {
					cb('Ignoring Stream Decks devices as the plugin has been enabled')
				} else if (ignoreStreamDeck) {
					cb('Ignoring Stream Decks devices as the stream deck app is running')
				} else {
					cb()
				}
			}
		}
	}

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
				device.productId === 0x008f &&
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
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0090 &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato-mini')
			} else if (
				!ignoreStreamDeck &&
				device.vendorId === 0x0fd9 &&
				device.productId === 0x0086 &&
				instances[device.path] === undefined
			) {
				self.addDevice(device, 'elgato-pedal')
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

		if (self.config.loupedeck_enable) {
			debug('Serial: checking devices')
			loupedeck
				.listLoupedecks()
				.then((devices) => {
					for (const device of devices) {
						if (instances[device.path] === undefined) {
							if (device.model === loupedeck.LoupedeckModelId.LoupedeckLive) {
								self.addDevice(device, 'loupedeck-live', true)
							}
						}
					}

					debug('Serial: done')
					completeScan()
				})
				.catch((e) => {
					completeScan(e)
				})
		} else {
			completeScan()
		}
	}

	try {
		// Make sure we don't try to take over stream deck devices when the stream deck application
		// is running on windows.
		if (!streamdeckDisabled && process.platform === 'win32') {
			// findProcess is broken on windows7, so skip it if running on that
			const parsed = semver.parse(os.release())
			if (parsed && semver.satisfies(parsed, '<= 6.2')) {
				scanUSB()
			} else {
				findProcess('name', 'Stream Deck')
					.then(function (list) {
						if (typeof list === 'object' && list.length > 0) {
							streamDeckSoftwareRunning = true
							debug('Elgato software detected, ignoring stream decks')
						}

						scanUSB()
					})
					.catch(function (err) {
						// ignore
						scanUSB()
					})
			}
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

elgatoDM.prototype.addDevice = function (device, type, skipAccessCheck) {
	var self = this
	debug('add device ' + device.path)

	if (instances[device.path] !== undefined) {
		instances[device.path].unload()
		delete instances[device.path]
	}

	if (type === 'elgatoEmulator') {
		instances[device.path] = new deviceHandler(system, new elgatoEmulator(system, device.path))

		self.updateDevicesList()
	} else if (type === 'streamdeck_plugin') {
		instances[device.path] = new deviceHandler(system, new elgatoPluginDevice(system, device.path))

		self.updateDevicesList()
	} else if (type === 'satellite_device') {
		instances[device.path] = new deviceHandler(system, new satelliteDeviceLegacy(system, device.path, device))

		self.updateDevicesList()
	} else if (type === 'satellite_device2') {
		instances[device.path] = new deviceHandler(system, new satelliteDevice(system, device))

		self.updateDevicesList()
	} else {
		if (!skipAccessCheck) {
			// Check if we have access to the device
			try {
				var devicetest = new HID.HID(device.path)
				devicetest.close()
			} catch (e) {
				system.emit(
					'log',
					'USB(' + type + ')',
					'error',
					'Found device, but no access. Please quit any other applications using the device, and try again.'
				)
				debug('device in use, aborting')
				return
			}
		}

		new usb(system, type, device.path, function (dev) {
			debug('initializing deviceHandler')
			instances[device.path] = new deviceHandler(system, dev)

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

// Simple singleton
var instance
exports = module.exports = function (system) {
	if (instance === undefined) {
		instance = new elgatoDM(system)
	}
	return instance
}

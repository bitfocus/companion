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
var satelliteDevice = require('./satellite_device')
var preview = require('./preview')
var system

HID.setDriverType('libusb')

debug('module required')

var instances = {}

function elgatoDM(_system) {
	var self = this
	system = _system

	system.on('elgatodm_remove_device', self.removeDevice.bind(self))

	system.on('devices_list_get', function (cb) {
		var ary = []
		var keys = Object.keys(instances)

		if (keys[0] != undefined) {
			ary.push({
				id: instances[keys[0]].id,
				serialnumber: instances[keys[0]].serialnumber,
				type: instances[keys[0]].type,
				config: instances[keys[0]].config,
			})
		}

		var item = 1
		while (item < keys.length) {
			if (instances[keys[item]].type === 'emulator') {
				ary.splice(0, 0, {
					id: instances[keys[item]].id,
					serialnumber: instances[keys[item]].serialnumber,
					type: instances[keys[item]].type,
					config: instances[keys[item]].config,
				})
			} else {
				var i = 0
				while (
					ary[i] !== undefined &&
					(ary[i].id == 'emulator' ||
						ary[i].type < instances[keys[item]].type ||
						(ary[i].type == instances[keys[item]].type && ary[i].serialnumber < instances[keys[item]].serialnumber))
				) {
					i++
				}
				ary.splice(i, 0, {
					id: instances[keys[item]].id,
					serialnumber: instances[keys[item]].serialnumber,
					type: instances[keys[item]].type,
					config: instances[keys[item]].config,
				})
			}
			item++
		}

		cb(ary)
	})

	system.on('devices_reenumerate', function () {
		self.refreshDevices()
	})

	system.emit('io_get', function (io) {
		self.io = io

		system.on('io_connect', function (socket) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					socket.emit(name, ...args)
				}
			}

			socket.on('devices_list_get', function () {
				self.updateDevicesList(socket)
			})

			socket.on('devices_reenumerate', function (answer) {
				self.refreshDevices(function (errMsg) {
					sendResult(answer, 'devices_reenumerate:result', errMsg)
				})
			})

			socket.on('device_config_get', function (_id, answer) {
				for (var id in instances) {
					if (instances[id].id == _id) {
						instances[id].getConfig(function (result) {
							sendResult(answer, 'device_config_get:result', null, result)
						})
						return
					}
				}
				sendResult(answer, 'device_config_get:result', 'device not found')
			})

			socket.on('device_config_set', function (_id, config) {
				for (var id in instances) {
					if (instances[id].id == _id) {
						instances[id].setConfig(config)
						socket.emit('device_config_set', null, 'ok')
						return
					}
				}
				socket.emit('device_config_set', 'device not found')
			})
		})
	})

	// Add emulator by default
	self.addDevice({ path: 'emulator' }, 'elgatoEmulator')

	// Initial search for USB devices
	self.refreshDevices()
}

elgatoDM.prototype.updateDevicesList = function (socket) {
	var self = this
	var ary = []
	var keys = Object.keys(instances)

	if (keys[0] != undefined) {
		ary.push({
			id: instances[keys[0]].id,
			serialnumber: instances[keys[0]].serialnumber,
			type: instances[keys[0]].type,
			config: instances[keys[0]].config,
		})
	}

	var item = 1
	while (item < keys.length) {
		if (instances[keys[item]].type === 'emulator') {
			ary.splice(0, 0, {
				id: instances[keys[item]].id,
				serialnumber: instances[keys[item]].serialnumber,
				type: instances[keys[item]].type,
				config: instances[keys[item]].config,
			})
		} else {
			var i = 0
			while (
				ary[i] !== undefined &&
				(ary[i].id == 'emulator' ||
					ary[i].type < instances[keys[item]].type ||
					(ary[i].type == instances[keys[item]].type && ary[i].serialnumber < instances[keys[item]].serialnumber))
			) {
				i++
			}
			ary.splice(i, 0, {
				id: instances[keys[item]].id,
				serialnumber: instances[keys[item]].serialnumber,
				type: instances[keys[item]].type,
				config: instances[keys[item]].config,
			})
		}
		item++
	}

	system.emit('devices_list', ary)

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
		for (var i = 0; i < devices.length; ++i) {
			;(function (device) {
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
				} else if (device.vendorId === 0xffff && device.productId === 0x1f40 && instances[device.path] === undefined) {
					self.addDevice(device, 'infinitton')
				} else if (device.vendorId === 0xffff && device.productId === 0x1f41 && instances[device.path] === undefined) {
					self.addDevice(device, 'infinitton')
				} else if (device.vendorId === 1523 && device.interface === 0) {
					self.addDevice(device, 'xkeys')
				}
			})(devices[i])
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
			debug('USB: scan failed')
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
		try {
			instances[device.path].quit()
		} catch (e) {}
		instances[device.path].deviceHandler.unload()

		delete instances[device.path].deviceHandler
		delete instances[device.path]
	}

	if (type === 'elgatoEmulator') {
		instances[device.path] = new elgatoEmulator(system, device.path)
		instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path])

		self.updateDevicesList()
	} else if (type === 'streamdeck_plugin') {
		instances[device.path] = new elgatoPluginDevice(system, device.path)
		instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path])

		self.updateDevicesList()
	} else if (type === 'satellite_device') {
		instances[device.path] = new satelliteDevice(system, device.path, device)
		instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path])

		self.updateDevicesList()
	} else {
		// Check if we have access to the device
		try {
			var devicetest = new HID.HID(device.path)
			devicetest.close()
		} catch (e) {
			system.emit(
				'log',
				'USB(' + type.device_type + ')',
				'error',
				'Found device, but no access. Please quit any other applications using the device, and try again.'
			)
			debug('device in use, aborting')
			return
		}

		instances[device.path] = new usb(system, type, device.path, function () {
			debug('initializing deviceHandler')
			instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path])

			self.updateDevicesList()
		})
	}
}

elgatoDM.prototype.removeDevice = function (devicepath) {
	var self = this
	debug('remove device ' + devicepath)
	if (instances[devicepath] !== undefined) {
		try {
			instances[devicepath].quit()
		} catch (e) {}
		instances[devicepath].deviceHandler.unload()

		delete instances[devicepath].deviceHandler
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

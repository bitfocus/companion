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

var debug   = require('debug')('lib/elgato_dm');
var HID = require('node-hid');
var findProcess = require('find-process');

var deviceHandler = require('./device');
var usb = require('./usb');
var elgatoEmulator = require('./elgato_emulator');
var elgatoPluginDevice = require('./elgato_plugin');
var satelliteDevice = require('./satellite_device');

HID.setDriverType('libusb');

debug("module required");

class device_manager {

	constructor(system) {
		this.system = system;
		this.instances = {};

		this.system.on('elgatodm_remove_device', this.removeDevice.bind(this));

		this.system.on('devices_list_get', (cb) => {
			var ary = [];

			for (var id in this.instances) {
				ary.push({
					id: this.instances[id].id,
					serialnumber: this.instances[id].serialnumber,
					type: this.instances[id].type,
					config: this.instances[id].config
				});
			}

			cb(ary);
		});

		this.system.emit('io_get', (io) => {
			this.io = io;

			this.system.on('io_connect', (client) => {
				client.on('devices_list_get', () => {
					this.updateDevicesList(client);
				});

				this.system.on('devices_reenumerate', () => {
					this.refreshDevices();
				});

				client.on('devices_reenumerate', () => {
					this.refreshDevices((errMsg) => {
						client.emit('devices_reenumerate:result', errMsg);
					});
				});

				client.on('device_config_get', (_id) => {
					for (var id in this.instances) {
						if (this.instances[id].id == _id) {
							this.instances[id].getConfig((result) => {
								client.emit('device_config_get:result', null, result);
							});
							return;
						}
					}
					client.emit('device_config_get:result', 'device not found');
				});

				client.on('device_config_set', (_id, config) => {
					for (var id in this.instances) {
						if (this.instances[id].id == _id) {
							this.instances[id].setConfig(config);
							client.emit('device_config_get:result', null, 'ok');
							return;
						}
					}
					client.emit('device_config_get:result', 'device not found');
				});
			});
		});

		// Add emulator by default
		this.addDevice({ path: 'emulator' }, 'elgatoEmulator');

		// Initial search for USB devices
		this.refreshDevices();
	}

	addDevice(device, type) {
		debug('add device ' + device.path);

		if (this.instances[device.path] !== undefined) {
			try {
				this.instances[device.path].quit();
			}
			catch (e) {}

			this.instances[device.path].deviceHandler.unload();

			delete this.instances[device.path].deviceHandler;
			delete this.instances[device.path];
		}

		if (type === 'elgatoEmulator') {
			this.instances[device.path] = new elgatoEmulator(this.system, device.path);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);

			this.updateDevicesList();
		}
		else if (type === 'streamdeck_plugin') {
			this.instances[device.path] = new elgatoPluginDevice(this.system, device.path);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);

			this.updateDevicesList();
		}
		else if (type === 'satellite_device') {
			this.instances[device.path] = new satelliteDevice(this.system, device.path, device);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);

			this.updateDevicesList();
		}
		else {
			// Check if we have access to the device
			try {
				var devicetest = new HID.HID(device.path);
				devicetest.close();
			}
			catch (e) {
				this.system.emit('log', 'USB(' + type.device_type + ')', 'error', 'Found device, but no access. Please quit any other applications using the device, and try again.');
				debug('device in use, aborting');
				return;
			}

			this.instances[device.path] = new usb(this.system, type, device.path, () => {
				debug('initializing deviceHandler');
				this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);

				this.updateDevicesList();
			});
		}
	}

	quit() {

		for (var devicepath in this.instances) {
			try {
				this.removeDevice(devicepath);
			}
			catch (e) {}
		}
	}

	refreshDevices(cb) {
		var ignoreStreamDeck = false;

		// Make sure we don't try to take over stream deck devices when the stream deck application
		// is running on windows.
		ignoreStreamDeck = false;

		try {
			if (process.platform === 'win32') {
				findProcess('name', 'Stream Deck').then((list) => {

					if (typeof list === 'object' && list.length > 0) {
						ignoreStreamDeck = true;
						debug('Not scanning for Stream Deck devices because we are on windows, and the stream deck app is running');
					}

					this.scanUSB(ignoreStreamDeck, cb);
				}).catch((err) => {
					// ignore
					this.scanUSB(ignoreStreamDeck, cb);
				});
			} else {
				// ignore
				this.scanUSB(ignoreStreamDeck, cb);
			}
		}
		catch (e) {
			try {
				// scan for all usb devices anyways
				this.scanUSB(ignoreStreamDeck, cb);
			}
			catch (e) {
				debug('USB: scan failed')
			}
		}
	}

	removeDevice(devicepath) {
		debug('remove device ' + devicepath);

		if (this.instances[devicepath] !== undefined) {
			try {
				this.instances[devicepath].quit();
			}
			catch (e) {}
			this.instances[devicepath].deviceHandler.unload();

			delete this.instances[devicepath].deviceHandler;
			delete this.instances[devicepath];
		}

		this.updateDevicesList();
	}

	scanUSB(ignoreStreamDeck, cb) {
		debug("USB: checking devices (blocking call)");
		var devices = HID.devices();

		for (var i = 0; i < devices.length; ++i) {
			let device = devices[i];

			if (!ignoreStreamDeck && device.vendorId === 0x0fd9 && device.productId === 0x0060 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato');
			}
			else if (!ignoreStreamDeck && device.vendorId === 0x0fd9 && device.productId === 0x0063 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato-mini');
			}
			else if (!ignoreStreamDeck && device.vendorId === 0x0fd9 && device.productId === 0x006c && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato-xl');
			}
			else if (!ignoreStreamDeck && device.vendorId === 0x0fd9 && device.productId === 0x006d && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato-v2');
			}
			else if (device.vendorId === 0xffff && device.productId === 0x1f40 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'infinitton');
			}
			else if (device.vendorId === 0xffff && device.productId === 0x1f41 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'infinitton');
			}
		}

		debug("USB: done");
		
		if (typeof cb === 'function') {
			if (ignoreStreamDeck) {
				cb('Not scanning for Stream Deck devices as the stream deck app is running')
			}
			else {
				cb()
			}
		}
	}

	updateDevicesList(socket) {
		var ary = [];

		for (var id in this.instances) {
			ary.push({
				id: this.instances[id].id,
				serialnumber: this.instances[id].serialnumber,
				type: this.instances[id].type,
				config: this.instances[id].config
			});
		}

		this.system.emit('devices_list', ary);

		if (socket !== undefined) {
			socket.emit('devices_list', ary);
		}
		else {
			this.io.emit('devices_list', ary);
		}
	}
}

// Simple singleton
var instance;
exports = module.exports = function (system) {
	if (instance === undefined) {
		instance = new device_manager(system);
	}
	return instance;
};

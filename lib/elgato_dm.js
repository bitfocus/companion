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
var deviceHandler = require('./device');
var usb = require('./usb');
var elgatoEmulator = require('./elgato_emulator');
var preview = require('./preview');
var system;

debug("module required");

var instances = {};

function elgatoDM(_system) {
	var self = this;
	system = _system;

	system.on('elgatodm_remove_device', self.removeDevice.bind(self));

	system.emit('io_get', function (io) {
		self.io = io;

		io.on('connect', function (socket) {
			socket.on('devices_list_get', function () {
				var ary = [];

				for (var id in instances) {
					ary.push({ serialnumber: instances[id].serialnumber, type: instances[id].type });
				}

				socket.emit('devices_list', ary);
			});

			socket.on('devices_reenumerate', function () {
				self.refreshDevices();
				socket.emit('devices_reenumerate:result', true);
			});
		});
	});

	// Add emulator by default
	self.addDevice({ path: 'emulator' }, 'elgatoEmulator');

	// Initial search for USB devices
	self.refreshDevices();
}

elgatoDM.prototype.updateDevicesList = function () {
	var self = this;
	var ary = [];

	for (var id in instances) {
		ary.push({ serialnumber: instances[id].serialnumber, type: instances[id].type });
	}

	self.io.emit('devices_list', ary);
};

elgatoDM.prototype.refreshDevices = function () {
	var self = this;

	debug("USB: checking devices (blocking call)");
	var devices = HID.devices();

	for (var i = 0; i < devices.length; ++i) {
		(function (device) {
			if (device.vendorId === 0x0fd9 && device.productId === 0x0060 && instances[device.path] === undefined) {
				self.addDevice(device, 'elgato');
			}
			if (device.vendorId === 0xffff && device.productId === 0x1f40 && instances[device.path] === undefined) {
				self.addDevice(device, 'infinitton');
			}

		})(devices[i]);
	}
	debug("USB: done");
};

elgatoDM.prototype.addDevice = function (device, type) {
	var self = this;
	debug('add device ' + device.path);

	if (type !== 'elgatoEmulator') {
		// Check if we have access to the device
		try {
			var devicetest = new HID.HID(device.path);
			devicetest.close();
		} catch (e) {
			system.emit('log', 'USB(' + type.device_type + ')', 'error', 'Found device, but no access. Please quit any other applications using the device, and try again.');
			debug('device in use, aborting');
			return;
		}

		instances[device.path] = new usb(system, type, device.path, function () {
			debug('initializing deviceHandler');
			instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path]);

			self.updateDevicesList();
		});
	} else {
		instances[device.path] = new elgatoEmulator(system, device.path);
		instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path]);

		self.updateDevicesList();
	}
};

elgatoDM.prototype.removeDevice = function (devicepath) {
	var self = this;
	debug('remove device ' + devicepath);
	if (instances[devicepath] !== undefined) {
		try {
			instances[devicepath].quit();
		} catch (e) {}
		instances[devicepath].deviceHandler.unload();

		delete instances[devicepath].deviceHandler;
		delete instances[devicepath];
	}

	self.updateDevicesList();
};

elgatoDM.prototype.quit = function () {
	var self = this;

	for (var devicepath in instances) {
		try {
			self.removeDevice(devicepath);
		} catch (e) {}
	}
};

exports = module.exports = function (system) {
	return new elgatoDM(system);
};

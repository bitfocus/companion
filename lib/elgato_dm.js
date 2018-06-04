var debug   = require('debug')('lib/elgato_dm');
var elgato  = require('./elgato');
var infinitton  = require('./infinitton');
var HID = require('node-hid');
var deviceHandler = require('./device');
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
	self.addDevice({ path: 'emulator' }, elgatoEmulator);

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
				self.addDevice(device, elgato);
			}
			if (device.vendorId === 0xffff && device.productId === 0x1f40 && instances[device.path] === undefined) {
				self.addDevice(device, infinitton);
			}

		})(devices[i]);
	}
	debug("USB: done");
};

elgatoDM.prototype.addDevice = function (device, type) {
	var self = this;
	debug('add device ' + device.path);

	instances[device.path] = new type(system, device.path);
	instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path]);

	self.updateDevicesList();
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

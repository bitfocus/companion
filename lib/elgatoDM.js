var debug   = require('debug')('lib/elgatoDM');
var elgato  = require('./elgato');
var HID = require('node-hid');
var deviceHandler = require('./device');
var elgatoEmulator = require('./elgato_emulator');
var system;

debug("module required");

var instances = {};

function elgatoDM(_system) {
	var self = this;
	system = _system;


	system.on('elgatodm_remove_device', self.removeDevice.bind(self));

	self.addDevice({ path: 'emulator' }, elgatoEmulator);

	setInterval(self.refreshDevices.bind(self), 2000);
}

elgatoDM.prototype.refreshDevices = function () {
	var self = this;
	var devices = HID.devices();

	debug("checking devices");
	for (var i = 0; i < devices.length; ++i) {
		(function (device) {

			if (device.vendorId === 0x0fd9 && device.productId === 0x0060 && instances[device.path] === undefined) {
				self.addDevice(device, elgato);
			}
		})(devices[i]);
	}
};

elgatoDM.prototype.addDevice = function (device, type) {
	var self = this;
	debug('add device ' + device.path);
	instances[device.path] = new type(system, device.path);
	instances[device.path].deviceHandler = new deviceHandler(system, instances[device.path]);
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

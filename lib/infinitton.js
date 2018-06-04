
var path         = require('path');
var Infinitton   = require('infinitton-idisplay');
var util         = require('util');
var fs           = require('fs');
var debug        = require('debug')('lib/infinitton');
var EventEmitter = require('events').EventEmitter;
var icons = {};

var system;

function infinitton(system, devicepath) {
	var self = this;

	self.type = 'Infinitton iDisplay device';

	debug('Adding infinitton iDisplay USB device', devicepath);

	self.devicepath = devicepath;
	self.Infinitton = new Infinitton(devicepath);
	self.buttonState = [];

	self.serialnumber = self.Infinitton.device.getDeviceInfo().serialNumber;

	system.emit('log', 'device('+devicepath+')', 'debug', 'Serial number ' + self.serialnumber);

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send infinitton ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});

	self.Infinitton.on('down', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=true;
		self.system.emit('elgato_click', devicepath, key, true, self.buttonState);
	});

	self.Infinitton.on('up', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
	});

	self.Infinitton.on('error', error => {
		console.error(error);
		system.emit('elgatodm_remove_device', devicepath);
	});

	// Initialize button state hash
	for (var button = 0; button < 15; button++) {
		self.buttonState[button] = {
			needsUpdate: true,
			pressed: false,
		};
	}

	for (var x = 0; x < 15; x++) {
		self.Infinitton.clearKey(x);
	}

	return self;
}

infinitton.prototype.quit = function () {
	var self = this;
	var sd = self.Infinitton;

	if (sd !== undefined) {
		try {
			this.clearDeck();
		} catch (e) {}

		// Find the actual streamdeck driver, to talk to the device directly
		if (sd.device === undefined && sd.streamdeck !== undefined) {
			sd = sd.streamdeck;
		}

		// If an actual streamdeck is connected, disconnect
		if (sd.device !== undefined) {
			sd.device.close();
		}
	}
};

infinitton.prototype.draw = function(key, buffer) {
	var self = this;

	if (buffer === undefined || buffer.length != 15552) {
		debug("buffer was not 15552, but ",buffer.length);
		return false;
	}

	try {
		self.Infinitton.fillImage(self.reverseButton(key), buffer);
	} catch (e) {
		self.system.emit('elgatodm_remove_device', self.devicepath);
	}

	return true;
}


infinitton.prototype.isPressed = function(key) {
	var self = this;
	debug('infinitton.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

infinitton.prototype.begin = function() {
	var self = this;
	debug('infinitton.prototype.begin()');

	self.Infinitton.setBrightness(100);
};

infinitton.prototype.buttonClear = function(key) {
	var self = this;
	debug('infinitton.prototype.buttonClear('+key+')')
	var k = self.mapButton(key);
	self.Infinitton.clearKey(k);
}

infinitton.prototype.mapButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	return map[input];
}

infinitton.prototype.reverseButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}
};

infinitton.prototype.clearDeck = function() {
	var self = this;
	debug('infinitton.prototype.clearDeck()')
	for (var x = 0; x < 15; x++) {
		self.Infinitton.clearKey(x);
	}
}

util.inherits(infinitton, EventEmitter);

exports = module.exports = infinitton;
/*function (system, devicepath) {
	return new infinitton(system, devicepath);
};*/

//exports = module.exports = infinitton;

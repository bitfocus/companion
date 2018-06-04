
var path         = require('path');
var StreamDeck   = require('elgato-stream-deck-clean');
var util         = require('util');
var fs           = require('fs');
var debug   = require('debug')('lib/elgato');
var EventEmitter = require('events').EventEmitter;
var icons = {};

var system;

function elgato(system, devicepath) {
	var self = this;

	self.type = 'Elgato Streamdeck device';

	debug('Adding Elgato Streamdeck USB device', devicepath);

	self.devicepath = devicepath;
	self.streamDeck = new StreamDeck(devicepath);
	self.buttonState = [];

	self.serialnumber = self.streamDeck.device.getDeviceInfo().serialNumber;

	system.emit('log', 'device('+devicepath+')', 'debug', 'Serial number '+self.serialnumber);

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send elgato ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});

	self.streamDeck.on('down', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=true;
		self.system.emit('elgato_click', devicepath, key, true, self.buttonState);
	});

	self.streamDeck.on('up', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
	});

	self.streamDeck.on('error', error => {
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
		self.streamDeck.clearKey(x);
	}

	return self;
}

elgato.prototype.quit = function () {
	var self = this;
	var sd = self.streamDeck;

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

elgato.prototype.draw = function(key, buffer) {
	var self = this;

	if (buffer === undefined || buffer.length != 15552) {
		debug("buffer was not 15552, but ",buffer.length);
		return false;
	}

	try {
		self.streamDeck.fillImage(self.reverseButton(key), buffer);
	} catch (e) {
		self.system.emit('elgatodm_remove_device', self.devicepath);
	}

	return true;
}


elgato.prototype.isPressed = function(key) {
	var self = this;
	debug('elgato.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgato.prototype.begin = function() {
	var self = this;
	debug('elgato.prototype.begin()')
	if (self.timer !== undefined) {
		clearTimeout(self.timer);
	}
	self.streamDeck.setBrightness(100);
};

elgato.prototype.buttonClear = function(key) {
	var self = this;
	debug('elgato.prototype.buttonClear('+key+')')
	var k = self.mapButton(key);
	self.streamDeck.clearKey(k);
}

elgato.prototype.mapButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	return map[input];
}

elgato.prototype.reverseButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}
};

elgato.prototype.clearDeck = function() {
	var self = this;
	debug('elgato.prototype.clearDeck()')
	for (var x = 0; x < 15; x++) {
		self.streamDeck.clearKey(x);
	}
}

util.inherits(elgato, EventEmitter);

exports = module.exports = elgato;
/*function (system, devicepath) {
	return new elgato(system, devicepath);
};*/

//exports = module.exports = elgato;

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


var path         = require('path');
var StreamDeck   = require('elgato-stream-deck-clean');
var util         = require('util');
var fs           = require('fs');
var debug        = require('debug')('lib/usb/elgato');
var common       = require('./common');
var icons = {};

var system;

function elgato(system, devicepath) {
	var self = this;

	self.info = {
		type: 'Elgato Streamdeck device',
		devicepath: devicepath,
		device_type: 'StreamDeck',
		config: [ 'brightness', 'orientation' ]
	};

	self.config = {
		brightness: 100,
		rotation: 0
	};

	debug('Adding Elgato Streamdeck USB device', devicepath);

	self.devicepath = devicepath;
	self.streamDeck = new StreamDeck(devicepath);
	self.buttonState = [];

	self.info.serialnumber = self.serialnumber = self.streamDeck.device.getDeviceInfo().serialNumber;

	system.emit('log', 'device('+self.serialnumber+')', 'debug', 'Elgato Streamdeck detected');

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send elgato ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});

	self.streamDeck.on('down', function (keyIndex) {
		var key = self.reverseButton(keyIndex);

		self.buttonState[key].pressed = true;
		self.system.emit('elgato_click', devicepath, key, true, self.buttonState);
	});

	self.streamDeck.on('up', function (keyIndex) {
		var key = self.reverseButton(keyIndex);

		self.buttonState[key].pressed = false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
	});

	self.streamDeck.on('error', function (error) {
		console.error(error);
		system.emit('elgatodm_remove_device', devicepath);
	});

	// Initialize button state hash
	for (var button = 0; button < 15; button++) {
		self.buttonState[button] = {
			pressed: false
		};
	}

	for (var x = 0; x < 15; x++) {
		self.streamDeck.clearKey(x);
	}

	common.apply(this, arguments);

	return self;
}
elgato.device_type = 'StreamDeck';

elgato.prototype.setConfig = function (config) {
	var self = this;
	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.streamDeck.setBrightness(config.brightness);
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		self.system.emit('device_redraw', self.devicepath);
	}

	self.config = config;
};

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

	buffer = self.handleBuffer(buffer);

	try {
		self.streamDeck.fillImage(self.reverseButton(key), buffer);
	} catch (e) {
		self.system.emit('elgatodm_remove_device', self.devicepath);
	}

	return true;
}

elgato.prototype.isPressed = function(key) {
	var self = this;
	self.log('elgato.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgato.prototype.begin = function() {
	var self = this;
	self.log('elgato.prototype.begin()');

	self.streamDeck.setBrightness(self.config.brightness);
};

elgato.prototype.buttonClear = function(key) {
	var self = this;
	self.log('elgato.prototype.buttonClear('+key+')')
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
	self.log('elgato.prototype.clearDeck()')
	for (var x = 0; x < 15; x++) {
		self.streamDeck.clearKey(x);
	}
}

util.inherits(elgato, common);

exports = module.exports = elgato;

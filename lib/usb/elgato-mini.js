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
var StreamDeck   = require('elgato-stream-deck-clean-mini');
var util         = require('util');
var fs           = require('fs');
var debug        = require('debug')('lib/usb/elgato_mini');
var common       = require('./common');
var icons = {};

var system;

function elgato_mini(system, devicepath) {
	var self = this;

	self.info = {
		type: 'Elgato Streamdeck-mini device',
		devicepath: devicepath,
		device_type: 'StreamDeck',
		config: [ 'brightness', 'orientation', 'page' ]
	};

	self.config = {
		brightness: 100,
		rotation: 0,
		page: 1
	};

	debug('Adding Elgato Streamdeck-mini USB device', devicepath);

	self.devicepath = devicepath;
	self.streamDeck = new StreamDeck(devicepath);
	self.buttonState = [];

	self.info.serialnumber = self.serialnumber = self.streamDeck.device.getDeviceInfo().serialNumber;

	system.emit('log', 'device('+self.serialnumber+')', 'debug', 'Elgato Streamdeck-mini detected');

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send elgato_mini ready message to devices :)
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

	for (var x = 0; x < 6; x++) {
		self.streamDeck.clearKey(x);
	}

	common.apply(this, arguments);

	return self;
}
elgato_mini.device_type = 'StreamDeck Mini';

elgato_mini.prototype.setConfig = function (config) {
	var self = this;

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.streamDeck.setBrightness(config.brightness);
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		self.system.emit('device_redraw', self.devicepath);
	}

	if (self.config.page != config.page && config.page !== undefined) {
		// also handeled in usb.js
		self.system.emit('device_redraw', self.devicepath);
	}

	self.config = config;
};

elgato_mini.prototype.quit = function () {
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

elgato_mini.prototype.draw = function(key, buffer) {
	var self = this;

	buffer = self.handleBuffer(buffer);

	try {
		var button = self.mapButton(key);
		if (button < 0 || button >= 6) {
			return true;
		}
		self.streamDeck.fillImage(self.mapButton(key), buffer);
	} catch (e) {
		self.system.emit('elgatodm_remove_device', self.devicepath);
	}

	return true;
}


elgato_mini.prototype.isPressed = function(key) {
	var self = this;
	self.log('elgato_mini.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgato_mini.prototype.begin = function() {
	var self = this;
	self.log('elgato_mini.prototype.begin()');

	self.streamDeck.setBrightness(self.config.brightness);
};

elgato_mini.prototype.buttonClear = function(key) {
	var self = this;
	self.log('elgato_mini.prototype.buttonClear('+key+')')
	var k = self.mapButton(key);
	self.streamDeck.clearKey(k);
}

elgato_mini.prototype.mapButton = function(input) {
	var self = this;
	return [99,0,1,2,99,99,3,4,5,99,99,99,99,99,99][input];
}

elgato_mini.prototype.reverseButton = function(input) {
	var self = this;
	return [1,2,3,6,7,8,0,0,0,0,0,0,0,0,0][input];
};

elgato_mini.prototype.clearDeck = function() {
	var self = this;
	self.log('elgato_mini.prototype.clearDeck()')
	for (var x = 0; x < 6; x++) {
		self.streamDeck.clearKey(x);
	}
}

util.inherits(elgato_mini, common);

exports = module.exports = elgato_mini;
/*function (system, devicepath) {
	return new elgato_mini(system, devicepath);
};*/

//exports = module.exports = elgato_mini;

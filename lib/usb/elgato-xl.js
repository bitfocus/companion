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
var StreamDeck   = require('elgato-stream-deck').openStreamDeck;
var util         = require('util');
var fs           = require('fs');
var debug        = require('debug')('lib/usb/elgato_xl');
var common       = require('./common');
var sharp        = require('sharp');
var icons = {};

var system;

function elgato_xl(system, devicepath) {
	var self = this;

	self.info = {
		type: 'Elgato Streamdeck XL device',
		devicepath: devicepath,
		device_type: 'StreamDeck',
		config: [ 'brightness', 'orientation', 'page' ],
		keysPerRow: 8,
		keysTotal: 32
	};

	self.config = {
		brightness: 100,
		rotation: 0,
		page: 1
	};

	process.on('uncaughtException', function (err) {
		system.emit('log', 'device'+self.serialnumber+')', 'debug', 'Exception:' + err);
	});

	debug('Adding Elgato Streamdeck XL USB device', devicepath);

	self.devicepath = devicepath;
	self.streamDeck = new StreamDeck(devicepath, {
		jpegOptions: {
			quality: 95,
			subsampling: 1 // 422
		}
	});
	self.buttonState = [];

	self.info.serialnumber = self.serialnumber = self.streamDeck.device.getDeviceInfo().serialNumber;

	system.emit('log', 'device('+self.serialnumber+')', 'debug', 'Elgato Streamdeck XL detected');

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send elgato_xl ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});

	self.streamDeck.on('down', function (keyIndex) {
		self.buttonState[keyIndex].pressed = true;
		self.system.emit('elgato_click', devicepath, keyIndex, true, self.buttonState);
	});

	self.streamDeck.on('up', function (keyIndex) {
		self.buttonState[keyIndex].pressed = false;
		self.system.emit('elgato_click', devicepath, keyIndex, false, self.buttonState);
	});

	self.streamDeck.on('error', function (error) {
		console.error(error);
		system.emit('elgatodm_remove_device', devicepath);
	});

	// Initialize button state hash
	for (var button = 0; button < global.MAX_BUTTONS; button++) {
		self.buttonState[button] = {
			pressed: false
		};
	}

	self.streamDeck.clearAllKeys();

	common.apply(this, arguments);

	return self;
}
elgato_xl.device_type = 'StreamDeck XL';

elgato_xl.prototype.setConfig = function (config) {
	var self = this;

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.streamDeck.setBrightness(config.brightness);
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		self.config.rotation = config.rotation;
		self.system.emit('device_redraw', self.devicepath);
	}

	if (self.config.page != config.page && config.page !== undefined) {
		self.config.page = config.page;

		// also handeled in usb.js
		self.system.emit('device_redraw', self.devicepath);
	}

	self.config = config;
};

elgato_xl.prototype.quit = function () {
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

elgato_xl.prototype.draw = function(key, buffer, ts) {
	var self = this;

	buffer = self.handleBuffer(buffer);

	try {
		var img = sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
		.resize(96, 96)
		.raw()
		.toBuffer()
		.then(function (newbuffer) {
			self.streamDeck.fillImage(key, newbuffer);
		});
	} catch (e) {
		debug('error', e);
		self.system.emit('elgatodm_remove_device', self.devicepath);
	}

	return true;
}

elgato_xl.prototype.isPressed = function(key) {
	var self = this;
	self.log('elgato_xl.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgato_xl.prototype.begin = function() {
	var self = this;
	self.log('elgato_xl.prototype.begin()');

	self.streamDeck.setBrightness(self.config.brightness);
};

elgato_xl.prototype.buttonClear = function(key) {
	var self = this;
	self.log('elgato_xl.prototype.buttonClear('+key+')')

	self.streamDeck.clearKey(key);
}

elgato_xl.prototype.clearDeck = function() {
	var self = this;
	self.log('elgato_xl.prototype.clearDeck()')

	self.streamDeck.clearAllKeys();
}

util.inherits(elgato_xl, common);

exports = module.exports = elgato_xl;

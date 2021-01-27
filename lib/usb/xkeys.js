/*
 * This file is part of the Companion project
 * Copyright (c) 2021 VICREO BV
 * Author: Jeffrey Davidsz <jeffrey.davidsz@vicreo.eu>
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
 */


var util         = require('util');
const { XKeys }  = require('xkeys');
var debug        = require('debug')('lib/usb/xkeys');
var common       = require('./common');
var myXkeysPanel;

function xkeys(system, devicepath) {
	var self = this;

	self.info = {};
	self.type = self.info.type = 'XKeys device';
	self.info.device_type = 'XKeys';
	self.info.config = [ 'brightness', 'keysPerRow', 'keysPerColumn' ];
	self.info.keysPerRow = 8;
	self.info.keysTotal = 80;
	global.MAX_BUTTONS = 80;

	debug('Adding xkeys USB device', devicepath);
	self.info.devicepath = self.devicepath = devicepath;
	myXkeysPanel = new XKeys(devicepath);
	self.buttonState = [];
	self.info.serialnumber = self.serialnumber = myXkeysPanel.deviceType.identifier;
	if(myXkeysPanel.deviceType.identifier == 'XK-80') {
		self.config = {
			brightness: 100,
			keysPerRow: 10,
			keysPerColumn: 7 
		};
	} else {
		self.config = {
			brightness: 100,
			keysPerRow: 16,
			keysPerColumn: 8 
		};
	}
	console.log(self.config);


	system.emit('log', 'device('+myXkeysPanel.deviceType.identifier+')', 'debug', 'XKeys detected');

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send xkeys ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});
	// Light up all buttons
	myXkeysPanel.setAllBacklights(true, false)
	myXkeysPanel.setAllBacklights(true, true)
	
	// Listen to pressed keys:
	myXkeysPanel.on('down', keyIndex => {
		var key = self.convertButton(keyIndex);
		console.log('Key pressed: ' + key)
		
		if (key === undefined) {
			return;
		}

		key =	this.setPageKey(key);
		self.buttonState[key].pressed = true;
		self.system.emit('elgato_click', devicepath, key, true, self.buttonState);

		// Light up a button when pressed:
		myXkeysPanel.setBacklight(keyIndex, false)
	})
	// Listen to released keys:
	myXkeysPanel.on('up', keyIndex => {
		var key = self.convertButton(keyIndex);
		// console.log('Key released: ' + key)

		if (key === undefined) {
			return;
		}

		key =	this.setPageKey(key);
		self.buttonState[key].pressed = false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
		// Turn off button light when released:
		myXkeysPanel.setBacklight(keyIndex, true)
	})

	myXkeysPanel.on('error', error => {
		console.error(error);
		system.emit('elgatodm_remove_device', devicepath);
	});
	
	// Initialize button state hash
	for (var button = 0; button < global.MAX_BUTTONS; button++) {
		self.buttonState[button] = {
			pressed: false
		};
	}
	
	common.apply(this, arguments);

	// self.clearDeck();

	return self;
}

xkeys.prototype.setPageKey = function(key) {
	var self = this;

	if (key > 31) {
		let pageNumber = parseInt(key / 32) + 1;
		self.system.emit('device_page_set', self.serialnumber, pageNumber)
		key = key - ((pageNumber-1) * 32)
	} else {
		self.system.emit('device_page_set', self.serialnumber, 1)
	}

	return key;
}

util.inherits(xkeys, common);
xkeys.device_type = 'Xkeys';

xkeys.prototype.getConfig = function () {
	var self = this;

	self.log('getConfig');

	return self.config;
};
//TODO
xkeys.prototype.setConfig = function (config) {
	var self = this;
	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		myXkeysPanel.setBacklightIntensity(config.brightness);
	}

	if (self.config.page != config.page && config.page !== undefined) {
		self.config.page = config.page;
	}

	self.config = config;
};
//TODO
xkeys.prototype.quit = function () {
	var self = this;
	var sd = myXkeysPanel;

	if (sd !== undefined) {
		try {
			this.clearDeck();
		} catch (e) {}

		// Find the actual xkeys driver, to talk to the device directly
		if (sd.device === undefined && sd.myXkeysPanel !== undefined) {
			sd = sd.myXkeysPanel;
		}

		// If an actual xkeys is connected, disconnect
		if (sd.device !== undefined) {
			sd.device.close();
		}
	}
};

xkeys.prototype.begin = function() {
	var self = this;
	self.log('xkeys.prototype.begin()');

	myXkeysPanel.setBacklightIntensity(self.config.brightness);
};

xkeys.prototype.convertButton = function(input) {
	var self = this;
	var map = [];
	for (var posss = 0; posss < self.config.keysPerRow; posss++) {
		for (var poss = 0; poss < self.config.keysPerColumn+1; poss++) {
			map.push((poss*10)+posss);
		} 
	}
	// var map = "0 10 20 30 40 50 60 70 1 11 21 31 41 51 61 71 2 12 22 32 42 52 62 72 3 13 23 33 43 53 63 73 4 14 24 34 44 54 64 74 5 15 25 35 45 55 65 75 6 16 26 36 46 56 66 76 7 17 27 37 47 57 67 77 8 18 28 38 48 58 68 78 9 19 29 39 49 59 69 79".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}

	return;
};
exports = module.exports = xkeys;

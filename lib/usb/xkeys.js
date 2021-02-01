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
	self.info.keysPerRow = 10;
	self.info.keysTotal = 80;
	self.config = {
		brightness: 100,
		keysPerRow: 10,
		keysPerColumn: 8 
	};

	debug('Adding xkeys USB device', devicepath);
	self.info.devicepath = self.devicepath = devicepath;
	myXkeysPanel = new XKeys(devicepath);
	self.buttonState = [];
	self.info.serialnumber = self.serialnumber = myXkeysPanel.deviceType.identifier;
	switch (myXkeysPanel.deviceType.identifier) {
		case 'XK-80' || 'XK-60' || 'XK-68 Jog-Shuttle':
			self.config.keysPerRow = 10;
			self.config.keysPerColumn = 8;
			break;
	
		case 'XR-32':
			self.config.keysPerRow = 16;
			self.config.keysPerColumn = 2;
			break;

		case 'XK-24':
			self.config.keysPerRow = 4;
			self.config.keysPerColumn = 8;
			break;

		case 'XK-8':
			self.config.keysPerRow = 8;
			self.config.keysPerColumn = 1;
			break;

		case 'XK-4':
			self.config.keysPerRow = 4;
			self.config.keysPerColumn = 1;
			break;

		case 'XK-12 Joystick':
			self.config.keysPerRow = 4;
			self.config.keysPerColumn = 3;
			break;

		case 'XKE-124 T-bar' || 'XKE-128':
			self.config.keysPerRow = 16;
			self.config.keysPerColumn = 8;
			break;

		default:
			global.MAX_BUTTONS = self.config.keysPerRow * self.config.keysPerColumn;
			break;
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
	// myXkeysPanel.setAllBacklights(on, redLight)
	myXkeysPanel.setAllBacklights(true, false) 
	myXkeysPanel.setAllBacklights(true, true)
	
	// Listen to pressed keys:
	myXkeysPanel.on('down', keyIndex => {
		system.emit('log', 'device('+myXkeysPanel.deviceType.identifier+')', 'debug', 'XKeys original press: '+ keyIndex);
		var key = self.convertButton(keyIndex);
		
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

		if (key === undefined) {
			return;
		}

		key =	this.setPageKey(key);
		self.buttonState[key].pressed = false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
		// Turn off button light when released:
		myXkeysPanel.setBacklight(keyIndex, true)
	})
	// Listen to t-bar changes:
	myXkeysPanel.on('tbar', (position, rawPosition) => {
		debug('T-bar position has changed: ' + position + ' (uncalibrated: ' + rawPosition + ')')
		self.setVariable('t-bar', position);
	})
	// Listen to jog wheel changes:
	myXkeysPanel.on('jog', deltaPos => {
		console.log('Jog position has changed: ' + deltaPos)
	})
	// Listen to shuttle changes:
	myXkeysPanel.on('shuttle', shuttlePos => {
		console.log('Shuttle position has changed: ' + shuttlePos)
	})
	// Listen to joystick changes:
	myXkeysPanel.on('joystick', position => {
		console.log('Joystick has changed:' + position) // {x, y, z}
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
	for (var leftRight = 0; leftRight < self.config.keysPerRow; leftRight++) {
		for (var topBottom = 0; topBottom < self.config.keysPerColumn; topBottom++) {
			map.push((topBottom*self.config.keysPerRow)+leftRight);
		} 
	}
	// var map = "0 10 20 30 40 50 60 70 1 11 21 31 41 51 61 71 2 12 22 32 42 52 62 72 3 13 23 33 43 53 63 73 4 14 24 34 44 54 64 74 5 15 25 35 45 55 65 75 6 16 26 36 46 56 66 76 7 17 27 37 47 57 67 77 8 18 28 38 48 58 68 78 9 19 29 39 49 59 69 79".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}

	return;
};
exports = module.exports = xkeys;

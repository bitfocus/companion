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

function xkeys(system, devicepath) {
	var self = this;
	
	self.internal = {label: 'internal'};
	self.myXkeysPanel;
	self.info = {};
	self.type = self.info.type = 'XKeys device';
	self.info.device_type = 'XKeys';
	self.info.config = [ 'brightness', 'page' ];
	self.info.keysPerRow = 10;
	self.info.keysTotal = 80;
	self.config = {
		brightness: 100,
		keysPerRow: 10,
		keysPerColumn: 8,
		tbarPosition: 0,
		jog: 0,
		shuttle: 0,
		joystick: 0,
		page: 1
	};

	debug('Adding xkeys USB device', devicepath);
	self.info.devicepath = self.devicepath = devicepath;
	self.myXkeysPanel = new XKeys(devicepath);
	self.buttonState = [];
	self.info.serialnumber = self.serialnumber = self.myXkeysPanel.deviceType.identifier;

	self.config.keysPerRow = self.myXkeysPanel.deviceType.columns;
	self.config.keysPerColumn = self.myXkeysPanel.deviceType.bankSize/self.myXkeysPanel.deviceType.columns;

	system.emit('log', 'device('+self.myXkeysPanel.deviceType.identifier+')', 'debug', 'XKeys detected');
	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send xkeys ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});
	// Light up all buttons
	// myXkeysPanel.setAllBacklights(on, redLight)
	self.myXkeysPanel.setAllBacklights(true, false);
	self.myXkeysPanel.setAllBacklights(false, true);
	
	// Listen to pressed keys:
	self.myXkeysPanel.on('down', keyIndex => {
		// system.emit('log', 'device('+self.myXkeysPanel.deviceType.identifier+')', 'debug', 'XKeys original press: '+ keyIndex);
		var key = self.convertButton(keyIndex);
		if (key === undefined) {
			return;
		}

		this.setPageKey(key);
		self.buttonState[key] = true;

		self.system.emit('elgato_click', devicepath, key, true, self.buttonState);

		// Light up a button when pressed:
		self.myXkeysPanel.setBacklight(keyIndex, true)
	})
	// Listen to released keys:
	self.myXkeysPanel.on('up', keyIndex => {
		var key = self.convertButton(keyIndex);

		if (key === undefined) {
			return;
		}

		this.setPageKey(key);
		self.buttonState[key].pressed = false;
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState);
		// Turn off button light when released:
		self.myXkeysPanel.setBacklight(keyIndex, false)
	})
	// Listen to t-bar changes:
	self.myXkeysPanel.on('tbar', (position, rawPosition) => {
		self.config.tbarPosition = position;
		system.emit('variable_instance_set', self.internal, 't-bar', position)
		debug('T-bar position has changed: ' + self.config.tbarPosition + ' (uncalibrated: ' + rawPosition + ')')
	})
	// Listen to jog wheel changes:
	self.myXkeysPanel.on('jog', deltaPos => {
		self.config.jog = deltaPos;
		system.emit('variable_instance_set', self.internal, 'jog', deltaPos)
		debug('Jog position has changed: ' + deltaPos)
	})
	// Listen to shuttle changes:
	self.myXkeysPanel.on('shuttle', shuttlePos => {
		self.config.shuttle = shuttlePos;
		system.emit('variable_instance_set', self.internal, 'shuttle', shuttlePos)
		debug('Shuttle position has changed: ' + shuttlePos)
	})
	// Listen to joystick changes:
	self.myXkeysPanel.on('joystick', position => {
		self.config.joystick = position;
		// system.emit('variable_instance_set', internal, 'joystick', position)
		debug('Joystick has changed:' + position) // {x, y, z}
	})

	self.myXkeysPanel.on('error', error => {
		debug(error);
		system.emit('elgatodm_remove_device', devicepath);
	});
	
	common.apply(this, arguments);

	// self.clearDeck();

	return self;
}

xkeys.prototype.setPageKey = function(key) {
	var self = this;

	if (key > 31) {
		let pageNumber = parseInt(key / 32) + 1;
		key = key - ((pageNumber-1) * 32)
		pageNumber = pageNumber + self.config.page -1;
		self.system.emit('device_page_set', self.serialnumber, pageNumber)
	} else {
		self.system.emit('device_page_set', self.serialnumber, self.config.page)
	}	
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
		self.myXkeysPanel.setBacklightIntensity(config.brightness);
	}

	if (self.config.page != config.page && config.page !== undefined) {
		self.config.page = config.page;
	}

	self.config = config;
};
//TODO
xkeys.prototype.quit = function () {
	var self = this;
	var sd = self.myXkeysPanel;

	if (sd !== undefined) {
		try {
			this.clearDeck();
		} catch (e) {}

		// Find the actual xkeys driver, to talk to the device directly
		if (sd.device === undefined && sd.self.myXkeysPanel !== undefined) {
			sd = sd.self.myXkeysPanel;
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

	self.myXkeysPanel.setBacklightIntensity(self.config.brightness);
};

xkeys.prototype.convertButton = function(input) {
	var self = this;
	var map = [];
	for (var leftRight = 0; leftRight < self.config.keysPerRow; leftRight++) {
		for (var topBottom = 0; topBottom < self.config.keysPerColumn; topBottom++) {
			map.push((topBottom*self.config.keysPerRow)+leftRight);
		} 
	}
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}

	return;
};
exports = module.exports = xkeys;

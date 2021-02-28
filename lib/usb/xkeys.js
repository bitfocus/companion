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


var util             = require('util');
var debug            = require('debug')('lib/usb/xkeys');
var common           = require('./common');
const xkeys_settings = require('./xkeys_products');
const HID            = require('node-hid');

function xkeys(system, devicepath) {
	var self = this;
	self.system = system;

	self.internal = {
		label: 'internal'
	};
	self.myXkeysPanel;
	self._buttonStates = {};
	self._analogStates = {};

	self.info = {};
	self.type = self.info.type = 'XKeys device';
	self.info.device_type = 'XKeys';
	self.info.config = ['brightness', 'page'];
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

	self.info.devicepath = self.devicepath = devicepath;
	const devices = HID.devices();
	// self.myXkeysPanel = new XKeys(devicepath);
	self.myXkeysPanel = new HID.HID(devicepath);
	self.myXkeysPanel.deviceType = xkeys_settings.models[0];
	devices.forEach(element => {
		if (element.path == devicepath) {
			let productId = element.productId;
			xkeys_settings.models.forEach(model => {
				if (model.productId.indexOf(productId) != -1) {
					self.myXkeysPanel.deviceType = model;
				}
			});
		}
	});

	debug('Adding xkeys USB device:', self.myXkeysPanel.deviceType.identifier);

	self.buttonState = [];
	self.info.serialnumber = self.serialnumber = self.myXkeysPanel.deviceType.identifier;

	self.config.keysPerRow = self.myXkeysPanel.deviceType.columns;
	self.config.keysPerColumn = self.myXkeysPanel.deviceType.bankSize / self.myXkeysPanel.deviceType.columns;
	if (self.myXkeysPanel.deviceType.productId == '999') {
		self.system.emit('log', 'Unkown XKEYS model', 'error', 'Please file an issue on github or slack');
	} else {
		self.system.emit('log', 'device(' + self.myXkeysPanel.deviceType.identifier + ')', 'debug', 'XKeys detected');
	}
	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.setAllBacklights(true, false);
	self.setAllBacklights(false, true);
	self.setBacklightIntensity(255);
	// send xkeys ready message to devices :)
	setImmediate(function () {
		system.emit('elgato_ready', devicepath);
	});

	self.myXkeysPanel.on('data', function (data) {
		const buttonStates = {};
		const analogStates = {};

		// Calculate keys
		for (let x = 0; x < self.myXkeysPanel.deviceType.columns; x++) {
			for (let y = 0; y < self.myXkeysPanel.deviceType.rows; y++) {
				const keyIndex = x * 8 + y;
				const d = data.readUInt32LE(2 + x);
				const bit = d & (1 << y) ? true : false;
				buttonStates[keyIndex] = bit;
			}
		}
		// Jog
		if (self.myXkeysPanel.deviceType.hasJog) {
			const d = data[(self.myXkeysPanel.deviceType.jogByte || 0) - 2] // Jog
			analogStates.jog = (d < 128 ? d : d - 256)
		}
		// Shuttle
		if (self.myXkeysPanel.deviceType.hasShuttle) {
			const d = data[(self.myXkeysPanel.deviceType.shuttleByte || 0) - 2] // Shuttle
			analogStates.shuttle = (d < 128 ? d : d - 256)
		}
		// Joystick
		if (self.myXkeysPanel.deviceType.hasJoystick) {
			let d = data.readUInt32LE(7) // Joystick X
			analogStates.joystick_x = (d < 128 ? d : d - 256)

			d = data.readUInt32LE(8) // Joystick Y
			analogStates.joystick_y = (d < 128 ? d : d - 256)

			d = data.readUInt32LE(9) // Joystick Z (twist of joystick)
			analogStates.joystick_z = (d < 128 ? d : d - 256)

		}
		// tbar
		if (self.myXkeysPanel.deviceType.hasTbar) {
			let d = data[(self.myXkeysPanel.deviceType.tbarByte || 0) - 2] // T-bar (calibrated)
			analogStates.tbar = d

			d = data.readUInt16BE((self.myXkeysPanel.deviceType.tbarByteRaw || 0) - 2) // T-bar (uncalibrated)
			analogStates.tbar_raw = d
		}
		// Disabled/nonexisting keys:
		if (self.myXkeysPanel.deviceType.disableKeys) {
			self.myXkeysPanel.deviceType.disableKeys.forEach((keyIndex) => {
				buttonStates[keyIndex] = false
			})
		}
		// Process keypress
		for (const buttonStateKey in buttonStates) {
			// compare with previous button states:
			if ((self._buttonStates[buttonStateKey] || false) !== buttonStates[buttonStateKey]) {
				if (buttonStates[buttonStateKey]) { // key is pressed
					// system.emit('log', 'device(' + self.myXkeysPanel.deviceType.identifier + ')', 'debug', 'XKeys original press: ' + buttonStateKey);
					let key = self.convertButton(buttonStateKey);
					if (key === undefined) {
						return;
					}

					let newKey = self.setPageKey(key);
					self.buttonState[key] = true;
					self.system.emit('elgato_click', devicepath, newKey, true, self.buttonState);
					self.setBacklight(buttonStateKey, true, true, false);

				} else {
					let key = self.convertButton(buttonStateKey);
					if (key === undefined) {
						return;
					}

					let newKey = self.setPageKey(key);
					self.buttonState[key].pressed = false;
					self.system.emit('elgato_click', devicepath, newKey, false, self.buttonState);
					self.setBacklight(buttonStateKey, false, true, false);

				}
			}
		}
		// Process analogStates
		for (const analogStateKey in analogStates) {
			// compare with previous states:
			if (
				(self._analogStates[analogStateKey] || 0) !== analogStates[analogStateKey]
			) {
				if (analogStateKey === 'jog') {
					self.config.jog = analogStates[analogStateKey];
					system.emit('variable_instance_set', self.internal, 'jog', analogStates[analogStateKey]);
					debug('Jog position has changed: ' + analogStates[analogStateKey]);
					// console.log(analogStateKey , analogStates[analogStateKey])
				} else if (analogStateKey === 'shuttle') {
					self.config.shuttle = analogStates[analogStateKey];
					system.emit('variable_instance_set', self.internal, 'shuttle', analogStates[analogStateKey]);
					debug('Shuttle position has changed: ' + analogStates[analogStateKey]);
				} else if (
					analogStateKey === 'tbar_raw'
				) {
					self.config.tbarPosition = analogStates.tbar;
					system.emit('variable_instance_set', self.internal, 't-bar', analogStates.tbar);
					debug('T-bar position has changed: ' + self.config.tbarPosition + ' (uncalibrated: ' + analogStates.tbar_raw + ')');
					// console.log('tbar', analogStates.tbar, analogStates.tbar_raw)
				} else if (
					analogStateKey === 'joystick_x' ||
					analogStateKey === 'joystick_y' ||
					analogStateKey === 'joystick_z'
				) {
					self.config.joystick = analogStates;
					system.emit('variable_instance_set', self.internal, 'joystick', analogStates)
					debug('Joystick has changed:' + analogStates) // {x, y, z}
					debug('joystick', {
						x: analogStates.joystick_x,
						y: analogStates.joystick_y,
						z: analogStates.joystick_z
					})
				} else if (
					analogStateKey !== 'tbar' // ignore tbar updates because event is emitted on tbar_raw update
				) {
					self.system.emit('log', 'Unknown analogStateKey:', 'error', analogStateKey);
				}

			}
		}
		self._buttonStates = buttonStates;
		self._analogStates = analogStates;
	})

	self.myXkeysPanel.on('error', error => {
		debug(error);
		system.emit('elgatodm_remove_device', devicepath);
	});

	common.apply(this, arguments);
	// self.clearDeck();
	return self;
}

/**
 * Sets the backlight of a key
 * @param {keyIndex} the key to set the color of
 * @param {on} boolean: on or off
 * @param {flashing} boolean: flashing or not (if on)
 * @returns undefined
 */
xkeys.prototype.setBacklight = function (keyIndex, on, redLight, flashing) {
	var self = this;
	if (keyIndex === 'PS') return // PS-button has no backlight

	self.verifyKeyIndex(keyIndex)

	if (redLight) {
		keyIndex = (typeof keyIndex === 'string' ? parseInt(keyIndex, 10) : keyIndex) + (self.myXkeysPanel.deviceType.bankSize || 0)
	}
	const message = self.padMessage([0, 181, keyIndex, (on ? (flashing ? 2 : 1) : 0), 1])
	self.write(message)
}
/**
 * Sets the backlightintensity of the device
 * @param {intensity} 0-100 (will be converted to 0-255)
 */
xkeys.prototype.setBacklightIntensity = function (blueIntensity, redIntensity) {
	var self = this;
	if (redIntensity === undefined) redIntensity = blueIntensity

	blueIntensity = Math.max(Math.min(Math.round(blueIntensity * 2.55), 255), 0);
	redIntensity = Math.max(Math.min(Math.round(redIntensity * 2.55), 255), 0);

	const message = (
		self.myXkeysPanel.deviceType.banks === 2 ?
		self.padMessage([0, 187, blueIntensity, redIntensity]) :
		self.padMessage([0, 187, blueIntensity])
	)
	self.write(message)
}
/**
 * Sets the backlight of all keys
 * @param {on} boolean: on or off
 * @param {redLight} boolean: if to set the red or blue backlights
 * @returns undefined
 */
xkeys.prototype.setAllBacklights = function (on, redLight) {
	var self = this;
	const message = self.padMessage([0, 182, (redLight ? 1 : 0), (on ? 255 : 0)])
	self.write(message)
}

/**
 * Writes a Buffer to the X-keys device
 *
 * @param {Buffer} buffer The buffer written to the device
 * @returns undefined
 */
xkeys.prototype.write = function (anyArray) {
	var self = this;
	const intArray = []
	for (const i in anyArray) {
		const v = anyArray[i]
		intArray[i] = (
			typeof v === 'string' ? parseInt(v, 10) : v
		)
	}
	try {
		// device.write([0x00, 0x01, 0x01, 0x05, 0xff, 0xff]);
		self.myXkeysPanel.write(intArray)
		// console.log(intArray)
		// return this.device.write(intArray)
	} catch (e) {
		console.log('error', e)
	}
}

util.inherits(xkeys, common);
xkeys.device_type = 'Xkeys';

xkeys.prototype.setPageKey = function (key) {
	var self = this;

	if (key > 31) {
		let pageNumber = parseInt(key / 32) + 1;
		key = key - ((pageNumber - 1) * 32)
		pageNumber = pageNumber + self.config.page - 1;
		self.system.emit('device_page_set', self.serialnumber, pageNumber)
		return key;
	} else {
		self.system.emit('device_page_set', self.serialnumber, self.config.page)
		return key;
	}
}

xkeys.prototype.getConfig = function () {
	var self = this;

	self.log('getConfig');

	return self.config;
};
//TODO
xkeys.prototype.setConfig = function (config) {
	var self = this;
	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.setBacklightIntensity(config.brightness);
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

xkeys.prototype.begin = function () {
	var self = this;
	self.log('xkeys.prototype.begin()');

	self.myXkeysPanel.setBacklightIntensity(self.config.brightness);
};

xkeys.prototype.padMessage = function (message) {
	const messageLength = 36
	while (message.length < messageLength) {
		message.push(0)
	}
	return message
};

xkeys.prototype.convertButton = function (input) {
	var self = this;
	var map = [];
	for (var leftRight = 0; leftRight < self.config.keysPerRow; leftRight++) {
		for (var topBottom = 0; topBottom < self.config.keysPerColumn; topBottom++) {
			map.push((topBottom * self.config.keysPerRow) + leftRight);
		}
	}
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}

	return;
};

xkeys.prototype.verifyKeyIndex = function (keyIndex) {
	var self = this;
	keyIndex = (typeof keyIndex === 'string' ? parseInt(keyIndex, 10) : keyIndex)

	if (!(keyIndex >= 0 && keyIndex < 8 * self.myXkeysPanel.deviceType.columns)) {
		throw new Error(`Invalid keyIndex: ${keyIndex}`)
	}
};

/**
 * Sets the LED of a key
 * @param {keyIndex} the LED to set the color of (0 = green, 1 = red)
 * @param {on} boolean: on or off
 * @param {flashing} boolean: flashing or not (if on)
 * @returns undefined
 */
xkeys.prototype.setLED = function (keyIndex, on, flashing) {
	var self = this;

	let ledIndex = 0
	if (keyIndex === 0) ledIndex = 6
	if (keyIndex === 1) ledIndex = 7

	const message = self.padMessage([0, 179, ledIndex, (on ? (flashing ? 2 : 1) : 0)])
	self.write(message)
};

exports = module.exports = xkeys;
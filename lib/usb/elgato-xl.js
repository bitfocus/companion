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
var StreamDeck   = require('elgato-stream-deck-clean-xl');
var fs           = require('fs');
var debug        = require('debug')('lib/usb/elgato_xl');
var SurfaceDriverCommon = require('./common');
var icons = {};

class SurfaceDriverElgatoXL extends SurfaceDriverCommon {

	getDriver(devicePath) {
		return new StreamDeck(devicePath);
	}

	// Override given driver has a built-in clearAll
	clearDeck() {
		this.log(this.type+'.clearDeck()')

		this.device.clearAllKeys();
	}

	getInfo(devicePath) {
		return {
			type: 'Elgato Streamdeck XL device',
			devicePath: devicePath,
			deviceType: 'StreamDeck',
			deviceTypeFull: 'StreamDeck XL',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 8,
			keysTotal: 32
		};
	}

	getNativeDevice() {
		var device;

		if (this.device !== undefined && this.device.streamdeck !== undefined) {
			return this.device.streamdeck;
		}
	}

	setupDriverListeners() {
		this.device.on('down', this.keyDown.bind(this));
		this.device.on('up', this.keyUp.bind(this));
		this.device.on('error', this.removeDevice.bind(this));
	}
}

exports = module.exports = SurfaceDriverElgatoXL;
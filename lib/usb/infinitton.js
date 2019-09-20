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
var Infinitton   = require('infinitton-idisplay');
var fs           = require('fs');
var debug        = require('debug')('lib/usb/infinitton');
var SurfaceDriverCommon = require('./common');
var icons = {};

class SurfaceDriverInfinitton extends SurfaceDriverCommon {

	getDriver(devicePath) {
		return new Infinitton(devicePath);
	}

	getInfo(devicePath) {
		return {
			type: 'Infinitton iDisplay device',
			devicePath: devicePath,
			deviceType: 'Infinitton',
			deviceTypeFull: 'Infinitton',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 5,
			keysTotal: 15,
			map: "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10"
		};
	}

	getNativeDevice() {
		var device;

		if (this.device !== undefined && this.device.Infinitton !== undefined) {
			return this.device.Infinitton;
		}
	}

	setupDriverListeners() {
		this.device.on('down', this.keyDown.bind(this));
		this.device.on('up', this.keyUp.bind(this));
		this.device.on('error', this.removeDevice.bind(this));
	}
}

exports = module.exports = SurfaceDriverInfinitton;

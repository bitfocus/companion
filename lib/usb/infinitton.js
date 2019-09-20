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


var Infinitton   = require('infinitton-idisplay');
var debug        = require('debug')('lib/usb/infinitton');
var { SurfaceDriverCommon, toDeviceMap, fromDeviceMap } = require('./common');

const KEY_MAP = [ 4, 3, 2, 1, 0, 9, 8, 7, 6, 5, 14, 13, 12, 11, 10 ];

class SurfaceDriverInfinitton extends SurfaceDriverCommon {
	constructor(system, devicepath) {
		super(system, devicepath, debug);
	}

	generateInfo(devicepath) {
		return {
			type: 'Infinitton iDisplay device',
			devicepath: devicepath,
			deviceType: 'Infinitton',
			deviceTypeFull: 'Infinitton',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 5,
			keysTotal: 15
		};
	}

	openDevice() {
		this.device = new Infinitton(this.devicepath);

		this.device.on('down', (key) => this.keyDown(fromDeviceMap(KEY_MAP, key)));
		this.device.on('up', (key) => this.keyUp(fromDeviceMap(KEY_MAP, key)));
		this.device.on('error', (error) => this.removeDevice(error));
	}

	closeDevice() {
		if (this.device && this.device.device) {
			this.device.device.close();
		}
		this.device = undefined;
	}

	setBrightness(brightness) {
		if (this.device) {
			this.device.setBrightness(brightness);
		}
	}

	getSerialNumber() {
		if (this.device && this.device.device) {
			this.device.device.getDeviceInfo().serialNumber;
		}
	}

	clearKey(key) {
		if (this.device) {
			const deviceKey = toDeviceMap(KEY_MAP, key);
			this.device.clearKey(deviceKey);
		}
	}
	fillImage(key, buffer) {
		if (this.device) {
			const deviceKey = toDeviceMap(KEY_MAP, key);
			this.device.fillImage(deviceKey, buffer);
		}
	}
}

exports = module.exports = SurfaceDriverInfinitton;

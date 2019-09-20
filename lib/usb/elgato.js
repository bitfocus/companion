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


var StreamDeck   = require('elgato-stream-deck-clean');
var debug        = require('debug')('lib/usb/elgato');
var { SurfaceDriverCommon, toDeviceMap, fromDeviceMap } = require('./common');

const KEY_MAP = [ 4, 3, 2, 1, 0, 9, 8, 7, 6, 5, 14, 13, 12, 11, 10 ];

class SurfaceDriverElgato extends SurfaceDriverCommon {
	constructor(system, devicepath) {
		super(system, devicepath, debug);
	}

	generateInfo(devicepath) {
		return {
			type: 'Elgato Streamdeck device',
			devicepath: devicepath,
			deviceType: 'StreamDeck',
			deviceTypeFull: 'StreamDeck',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 5,
			keysTotal: 15
		};
	}

	openDevice() {
		this.device = new StreamDeck(this.devicepath);

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
			return this.device.device.getDeviceInfo().serialNumber;
		} else {
			return '';
		}
	}

	clearKey(key) {
		if (this.device) {
			const deviceKey = toDeviceMap(KEY_MAP, key);
			this.device.clearKey(deviceKey);
		}
	}

	clearDeck() {
		// Override given driver has a built-in clearAll
		this.log(this.type+'.clearDeck()');
		if (this.device) {
			this.device.clearAllKeys();
		}
	}

	fillImage(key, buffer) {
		if (this.device) {
			const deviceKey = toDeviceMap(KEY_MAP, key);
			this.device.fillImage(deviceKey, buffer);
		}
	}
}

exports = module.exports = SurfaceDriverElgato;

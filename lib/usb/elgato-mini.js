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


var StreamDeck   = require('elgato-stream-deck-clean-mini');
var debug        = require('debug')('lib/usb/elgato_mini');
var { SurfaceDriverCommon } = require('./common');

class SurfaceDriverElgatoMini extends SurfaceDriverCommon {
	constructor(system, devicepath) {
		super(system, devicepath, debug);
	}

	generateInfo(devicepath) {
		return {
			type: 'Elgato Streamdeck-mini device',
			devicepath: devicepath,
			deviceType: 'StreamDeck',
			deviceTypeFull: 'StreamDeck Mini',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 3,
			keysTotal: 6
		};
	}

	openDevice() {
		this.device = new StreamDeck(this.devicepath);

		this.device.on('down', (key) => this.keyDown(key));
		this.device.on('up', (key) => this.keyUp(key));
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
			this.device.clearKey(key);
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
			this.device.fillImage(key, buffer);
		}
	}
}

exports = module.exports = SurfaceDriverElgatoMini;
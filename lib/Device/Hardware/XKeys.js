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

const { XKeys }    = require('xkeys');
const DeviceBase   = require('../Base');
const debug        = require('debug')('lib/Device/Hardware/XKeys');
const internal     = { label: 'internal' };

class DeviceHardwareXKeys extends DeviceBase {

	static deviceType = 'Xkeys';

	constructor(system, devicepath) {
		super();
		this.system = system;

		this.info = {};
		this.type = this.info.type = 'XKeys device';
		this.info.device_type = 'XKeys';
		this.info.config = [ 'brightness', 'keysPerRow', 'keysPerColumn', 'page' ];
		this.info.keysPerRow = 10;
		this.info.keysTotal = 80;
		this.config = {
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
		this.info.devicepath = this.devicepath = devicepath;
		this.panel = new XKeys(devicepath);
		this.buttonState = [];
		this.info.serialnumber = this.serialnumber = this.panel.deviceType.identifier;

		switch (this.panel.deviceType.identifier) {
			case 'XK-80' || 'XK-60' || 'XK-68 Jog-Shuttle':
				this.config.keysPerRow = 10;
				this.config.keysPerColumn = 8;
				break;
		
			case 'XR-32':
				this.config.keysPerRow = 16;
				this.config.keysPerColumn = 2;
				break;

			case 'XK-24':
				this.config.keysPerRow = 4;
				this.config.keysPerColumn = 8;
				break;

			case 'XK-8':
				this.config.keysPerRow = 8;
				this.config.keysPerColumn = 1;
				break;

			case 'XK-4':
				this.config.keysPerRow = 4;
				this.config.keysPerColumn = 1;
				break;

			case 'XK-12 Joystick':
				this.config.keysPerRow = 4;
				this.config.keysPerColumn = 3;
				break;

			case 'XKE-124 T-bar' || 'XKE-128':
				this.config.keysPerRow = 16;
				this.config.keysPerColumn = 8;
				break;

			case 'XKE-64 JogT-bar':
				this.config.keysPerRow = 10;
				this.config.keysPerColumn = 8;
				break;
				
			default:
				global.MAX_BUTTONS = this.config.keysPerRow * this.config.keysPerColumn;
				break;
		}

		this.system.emit('log', 'device('+this.panel.deviceType.identifier+')', 'debug', 'XKeys detected');

		// How many items we have left to load until we're ready to begin
		this.loadingItems = 0;
		this.system = system;

		// send xkeys ready message to devices :)
		setImmediate(function() {
			this.system.emit('elgato_ready', devicepath);
		});
		// Light up all buttons
		// this.panel.setAllBacklights(on, redLight)
		this.panel.setAllBacklights(true, false) 
		this.panel.setAllBacklights(false, true)
		
		// Listen to pressed keys:
		this.panel.on('down', keyIndex => {
			// system.emit('log', 'device('+this.panel.deviceType.identifier+')', 'debug', 'XKeys original press: '+ keyIndex);
			var key = this.convertButton(keyIndex);
			
			if (key === undefined) {
				return;
			}

			key = this.setPageKey(key);

			if (this.buttonState[key] !== undefined) {
				this.buttonState[key].pressed = true;
			}

			this.system.emit('elgato_click', devicepath, key, true, this.buttonState);

			// Light up a button when pressed:
			this.panel.setBacklight(keyIndex, false)
		})
		// Listen to released keys:
		this.panel.on('up', keyIndex => {
			var key = this.convertButton(keyIndex);

			if (key === undefined) {
				return;
			}

			key =	this.setPageKey(key);
			this.buttonState[key].pressed = false;
			this.system.emit('elgato_click', devicepath, key, false, this.buttonState);
			// Turn off button light when released:
			this.panel.setBacklight(keyIndex, true)
		})
		// Listen to t-bar changes:
		this.panel.on('tbar', (position, rawPosition) => {
			this.config.tbarPosition = position;
			this.system.emit('variable_instance_set', internal, 't-bar', position)
			debug('T-bar position has changed: ' + this.config.tbarPosition + ' (uncalibrated: ' + rawPosition + ')')
		})
		// Listen to jog wheel changes:
		this.panel.on('jog', deltaPos => {
			this.config.jog = deltaPos;
			this.system.emit('variable_instance_set', internal, 'jog', deltaPos)
			debug('Jog position has changed: ' + deltaPos)
		})
		// Listen to shuttle changes:
		this.panel.on('shuttle', shuttlePos => {
			this.config.shuttle = shuttlePos;
			system.emit('variable_instance_set', internal, 'shuttle', shuttlePos)
			debug('Shuttle position has changed: ' + shuttlePos)
		})
		// Listen to joystick changes:
		this.panel.on('joystick', position => {
			this.config.joystick = position;
			// system.emit('variable_instance_set', internal, 'joystick', position)
			debug('Joystick has changed:' + position) // {x, y, z}
		})

		this.panel.on('error', error => {
			console.error(error);
			this.system.emit('elgatodm_remove_device', devicepath);
		});
		
		// Initialize button state hash
		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false
			};
		}

		// this.clearDeck();
	}

	begin() {
		this.log('xkeys.prototype.begin()');

		this.panel.setBacklightIntensity(this.config.brightness);
	}

	convertButton(input) {
		var map = [];

		for (var leftRight = 0; leftRight < this.config.keysPerRow; leftRight++) {
			for (var topBottom = 0; topBottom < this.config.keysPerColumn; topBottom++) {
				map.push((topBottom*this.config.keysPerRow)+leftRight);
			} 
		}
		// var map = "0 10 20 30 40 50 60 70 1 11 21 31 41 51 61 71 2 12 22 32 42 52 62 72 3 13 23 33 43 53 63 73 4 14 24 34 44 54 64 74 5 15 25 35 45 55 65 75 6 16 26 36 46 56 66 76 7 17 27 37 47 57 67 77 8 18 28 38 48 58 68 78 9 19 29 39 49 59 69 79".split(/ /);
		for (var pos = 0; pos < map.length; pos++) {
			if (map[input] == pos) return pos;
		}

		return;
	}

	getConfig() {
		this.log('getConfig');

		return this.config;
	}

	quit() {
		var sd = this.panel;

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
	}

	setConfig(config) {

		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.panel.setBacklightIntensity(config.brightness);
		}

		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page;
		}

		this.config = config;
	}

	setPageKey(key) {

		if (key > 31) {
			let pageNumber = parseInt(key / 32) + 1;
			key = key - ((pageNumber-1) * 32)
			pageNumber = pageNumber + this.config.page -1;
			this.system.emit('device_page_set', this.serialnumber, pageNumber)
		}
		else {
			this.system.emit('device_page_set', this.serialnumber, this.config.page)
		}
		
		return key;
	}
}

exports = module.exports = DeviceHardwareXKeys;

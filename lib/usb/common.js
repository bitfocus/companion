
function rotateBuffer(buffer, rotation) {
	if (buffer.type == 'Buffer') {
		buffer = new Buffer(buffer.data);
	}

	if (buffer === undefined || buffer.length != 15552) {
		this.log("buffer was not 15552, but " + buffer.length);
		return false;
	}

	if (rotation === -90) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), (y*72*3) + ((71-x) * 3), 3);
			}
		}
		return buf;
	} else if (rotation === 180) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), ((71-x)*72*3) + ((71-y) * 3), 3);
			}
		}
		return buf;
	} else if (rotation === 90) {
		var buf = new Buffer(15552);

		for (var x = 0; x < 72; ++x) {
			for (var y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3),3), ((71-y)*72*3) + (x * 3), 3);
			}
		}
		return buf;
	} else {
		return buffer;
	}
}

function toDeviceMap (map, key) {
	if (key >= 0 && key < map.length) {
		return map[key];
	} else {
		return -1;
	}
}
function fromDeviceMap (map, key) {
	return map.indexOf(key);
}

class SurfaceDriverCommon {

	constructor(system, devicepath, debug) {
		this.system = system;
		this.debug = debug;
		this.devicepath = devicepath;

		this.info = this.generateInfo(devicepath);

		this.type = this.info.type;
		this.deviceType = this.info.deviceTypeFull;
		this.keysTotal  = this.info.keysTotal;
		this.keysPerRow = this.info.keysPerRow;

		this.config = {
			brightness: 100,
			rotation: 0,
			page: 1
		};

		debug('Adding '+this.info.type+' device', devicepath);

		process.on('uncaughtException', function (err) {
			system.emit('log', 'device'+this.serialnumber+')', 'debug', 'Exception:' + err);
		});

		this.openDevice();

		this.info.serialnumber = this.serialnumber = this.getSerialNumber();

		this.system.emit('log', 'device('+this.serialnumber+')', 'debug', 'Elgato Streamdeck detected');

		// send elgato ready message to devices :)
		setImmediate(() => {
			this.system.emit('elgato_ready', devicepath);
		});

		this.initializeButtonStates();

		this.clearDeck();
	}

	begin() {
		this.log(this.type+'.begin()');

		this.setBrightness(this.config.brightness);
	}

	buttonClear(key) {
		this.log(this.type+'.buttonClear('+key+')');
		key = this.toDeviceKey(key);

		if (key >= 0 && !isNaN(key)) {
			this.clearKey(key);
		}
	}

	clearDeck() {
		this.log(this.type+'.clearDeck()');

		for (var x = 0; x < this.keysTotal; x++) {
			this.clearKey(x);
		}
	}

	draw(key, buffer, attempts = 0) {

		if (attempts === 0) {
			buffer = rotateBuffer(buffer, this.config.rotation);
		}

		attempts++;

		var drawKey = this.toDeviceKey(key);

		try {

			if (drawKey !== undefined && drawKey >= 0 && drawKey < this.keysTotal) {
				this.fillImage(drawKey, buffer);
			}

			return true;
		} catch (e) {
			this.log(this.deviceType+' USB Exception: ' + e.message);

			if (attempts > 2) {
				this.log('Giving up USB device ' + this.devicepath);
				this.system.emit('elgatodm_remove_device', this.devicepath);

				return false;
			}

			// alternatively a setImmediate() or nextTick()
			setTimeout(this.draw.bind(this), 20, key, buffer, attempts);
		}
	}

	getConfig() {
		this.log('getConfig');

		return this.config;
	}

	/**
	 * ABSTRACT:
	 */
	setBrightness(brightness) { }

	/**
	 * ABSTRACT:
	 */
	openDevice() { }

	/**
	 * ABSTRACT:
	 */
	closeDevice() { }

	/**
	 * ABSTRACT:
	 */
	getSerialNumber() { return ''; }

	/**
	 * ABSTRACT:
	 */
	clearKey(key) { }

	/**
	 * ABSTRACT:
	 */
	fillImage(key, buffer) { }

	initializeButtonStates() {
		this.buttonState = [];

		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false
			};
		}
	}

	isPressed(key) {
		key = this.toDeviceKey(key);
		this.log(this.type+'.isPressed('+key+')');

		if (key >= 0 && this.buttonState[key] !== undefined) {
			return this.buttonState[key].pressed;
		}
		else {
			return false;
		}
	}

	keyDown(keyIndex) {
		var key = this.toGlobalKey(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = true;
		this.system.emit('elgato_click', this.devicepath, key, true, this.buttonState);
	}

	keyUp(keyIndex) {
		var key = this.toGlobalKey(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = false;
		this.system.emit('elgato_click', this.devicepath, key, false, this.buttonState);
	}

	log(...args) {
		console.log(...args);
	}

	quit() {
		try {
			this.clearDeck();

			this.closeDevice();
		} catch (e) {
			// Device already closed/broken
		}
	}

	removeDevice(error) {
		console.error(error);
		this.system.emit('elgatodm_remove_device', this.devicepath);
	}

	setConfig(config) {

		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.setBrightness(config.brightness);
		}

		if (this.config.rotation != config.rotation && config.rotation !== undefined) {
			this.config.rotation = config.rotation;
			this.system.emit('device_redraw', this.devicepath);
		}

		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page;

			// also handeled in usb.js
			this.system.emit('device_redraw', this.devicepath);
		}

		this.config = config;
	}

	// From Global key number 0->31, to Device key f.ex 0->14
	// 0-4 would be 0-4, but 5-7 would be -1
	// and 8-12 would be 5-9
	toDeviceKey(key) {

		if (this.keysTotal == global.MAX_BUTTONS) {
			return key;
		}

		if (key % global.MAX_BUTTONS_PER_ROW > this.keysPerRow) {
			return -1;
		}

		var row = Math.floor(key / global.MAX_BUTTONS_PER_ROW);
		var col = key % global.MAX_BUTTONS_PER_ROW;

		if (row >= (this.keysTotal / this.keysPerRow) || col >= this.keysPerRow) {
			return -1;
		}

		return (row * this.keysPerRow) + col;
	}

	// From device key number to global key number
	// Reverse of toDeviceKey
	toGlobalKey (key) {
		var rows = Math.floor(key / this.keysPerRow);
		var col = key % this.keysPerRow;

		return (rows * global.MAX_BUTTONS_PER_ROW) + col;
	}
}

module.exports = {
	SurfaceDriverCommon,
	rotateBuffer,
	toDeviceMap,
	fromDeviceMap
};

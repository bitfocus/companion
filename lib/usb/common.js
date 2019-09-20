class SurfaceDriverCommon {

	constructor(system, devicePath) {
		this.system = system;
		this.debug = debug;
		this.devicePath = devicePath;

		this.info = this.getInfo(this.devicePath);

		this.deviceType = this.info.deviceTypeFull;
		this.keysTotal  = this.info.keysTotal;
		this.keysPerRow = this.info.keysPerRow;

		this.config = {
			brightness: 100,
			rotation: 0,
			page: 1
		};

		if (typeof this.info.map !== undefined) {
			this.setMap(this.info.map);
		}

		process.on('uncaughtException', function (err) {
			system.emit('log', 'device'+this.serialnumber+')', 'debug', 'Exception:' + err);
		});

		debug('Adding '+this.info.type+' device', devicePath);

		this.device = this.getDriver();

		this.info.serialnumber = this.serialnumber = this.getserialNumber();

		this.system.emit('log', 'device('+this.serialnumber+')', 'debug', 'Elgato Streamdeck detected');

		// How many items we have left to load until we're ready to begin
		this.loadingItems = 0;

		// send elgato ready message to devices :)
		setImmediate(() => {
			this.system.emit('elgato_ready', devicePath);
		});

		this.setupDriverListeners();

		this.initializeButtonStates();

		this.clearDeck();
	}

	begin() {
		this.log(this.type+'.begin()');

		this.device.setBrightness(this.config.brightness);
	}

	buttonClear(key) {
		this.log(this.type+'.buttonClear('+key+')')
		var key = this.mapButton(key);

		if (key >= 0 && !isNaN(key)) {
			this.device.clearKey(key);
		}
	}

	clearDeck() {
		this.log(this.type+'.clearDeck()')

		for (var x = 0; x < this.keysTotal; x++) {
			this.device.clearKey(x);
		}
	}

	draw(key, buffer, attempts = 0) {

		if (attempts === 0) {
			buffer = this.handleBuffer(buffer);
		}

		attempts++;

		var drawKey = this.mapButton(key);

		try {

			if (drawKey !== undefined && drawKey >= 0 && drawKey < this.keysTotal) {
				this.device.fillImage(drawKey, buffer);
			}

			return true;
		} catch (e) {
			this.log(this.deviceType+' USB Exception: ' + e.message);

			if (attempts > 2) {
				this.log('Giving up USB device ' + this.devicePath);
				this.system.emit('elgatodm_remove_device', this.devicePath);

				return false;
			}

			// alternatively a setImmediate() or nextTick()
			setTimeout(this.draw.bind(this), 20, key, buffer, attempts)
		}
	}

	getConfig() {
		this.log('getConfig');

		return this.config;
	}

	/**
	 * ABSTRACT: override to return a base 'info' object
	 */
	getInfo(devicePath) { return {}; }

	/**
	 * ABSTRACT: override to return the native device from the drvier
	 * for direct communication needs
	 */
	getNativeDevice() {}

	getSerialNumber() {
		if (this.device !== undefined && this.device.device !== undefined) {
			this.device.device.getDeviceInfo().serialNumber;
		}
	}

	handleBuffer(buffer) {

		if (buffer.type == 'Buffer') {
			buffer = new Buffer(buffer.data);
		}

		if (buffer === undefined || buffer.length != 15552) {
			this.log("buffer was not 15552, but " + buffer.length);
			var args = [].slice.call(arguments);
			return false;
		}

		if (this.config.rotation === -90) {
			var buf = new Buffer(15552);

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), (y*72*3) + ((71-x) * 3), 3);
				}
			}
			buffer = buf;
		}

		if (this.config.rotation === 180) {
			var buf = new Buffer(15552);

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE((x*72*3)+(y*3),3), ((71-x)*72*3) + ((71-y) * 3), 3);
				}
			}
			buffer = buf;
		}

		if (this.config.rotation === 90) {
			var buf = new Buffer(15552);

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3),3), ((71-y)*72*3) + (x * 3), 3);
				}
			}
			buffer = buf;
		}

		return buffer;
	}

	initializeButtonStates() {
		this.buttonState = [];

		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false
			};
		}
	}

	isPressed(key) {
		key = this.mapButton(key);
		this.log(this.type+'.isPressed('+key+')')

		if (key >= 0 && this.buttonState[key] !== undefined) {
			return this.buttonState[key].pressed;
		}
		else {
			return false;
		}
	}

	keyDown(keyIndex) {
		var key = this.reverseButton(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = true;
		this.system.emit('elgato_click', this.devicePath, key, true, this.buttonState);
	}

	keyUp(keyIndex) {
		var key = this.reverseButton(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = false;
		this.system.emit('elgato_click', this.devicePath, key, false, this.buttonState);
	}

	log() {
		console.log.apply(console, arguments);
	}

	mapButton(input) {
		var out;
		var deviceKey = this.toDeviceKey(input);

		if (this.map.length > 0 && deviceKey >= 0) {
			out = this.map[deviceKey];
		}
		else if (deviceKey < 0) {
			out = -1;
		}
		else {
			out = deviceKey
		}

		return out;
	}

	quit() {
		var sd = this.device;

		if (sd !== undefined) {
			try {
				this.clearDeck();
			} catch (e) {}

			// Find the actual driver, to talk to the device directly
			if (sd.device === undefined && this.getNativeDevice() !== undefined) {
				sd = this.getNativeDevice();
			}

			// If an actual device is connected, disconnect
			if (sd.device !== undefined) {
				sd.device.close();
			}
		}
	}

	removeDevice(error) {
		console.error(error);
		this.system.emit('elgatodm_remove_device', this.devicePath);
	}

	reverseButton(input) {
		var out;
		var deviceKey = this.toDeviceKey(input);

		if (this.map.length > 0) {
			for (var pos = 0; pos < this.map.length; pos++) {
				if (this.map[input] == pos){
					out = this.toGlobalKey(pos);
					break;
				}
			}
		}
		else {
			out = input;
		}

		return out;
	}

	setConfig(config) {

		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.device.setBrightness(config.brightness);
		}

		if (this.config.rotation != config.rotation && config.rotation !== undefined) {
			this.config.rotation = config.rotation;
			this.system.emit('device_redraw', this.devicePath);
		}

		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page;

			// also handeled in usb.js
			this.system.emit('device_redraw', this.devicePath);
		}

		this.config = config;
	}

	setMap(map) {

		if (typeof map === Array || map instanceof Array) {
			this.map = map;

			for (var key = 0; key < this.map.length; key++) {
				var value = this.map[key];

				if (typeof value === 'string' || value instanceof String) {
					var temp = parseInt(value);

					if (isNaN(temp)) {
						this.log(this.type+'.setMap() - invalid key ('+value+') parsed');
						this.map[key] = -1;
					}
					else {
						this.map[key] = temp;
					}
				}
			}
		}
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

exports = module.exports = SurfaceDriverCommon;

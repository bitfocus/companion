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


var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var debug        = require('debug')('lib/elgato_emulator');
var path         = require('path');

var system;
var express;
var io;

function elgatoEmulator(_system, devicepath) {
	var self = this;

	system = _system;
	EventEmitter.call(self);
	self.buttonState = [];

	self.type = 'Elgato Streamdeck Emulator';
	self.serialnumber = 'emulator';
	self.id = 'emulator';

	debug('Adding Elgato Streamdeck Emulator');

	self.devicepath = devicepath;
	self.keys = {};

	self.config = [];

	system.emit('io_get', function (_io) {
		io = _io;
	});

	io.on('connect', function (socket) {
		socket.on('emul_startup', function () {
			for (var key in self.keys) {
				socket.emit('emul_fillImage', key, self.keys[key]);
			}
		});

		socket.on('emul_down', function (keyIndex) {
			var key = self.reverseButton(keyIndex);

			self.buttonState[key].pressed = true;
			system.emit('elgato_click', devicepath, key, true, self.buttonState);
		});

		socket.on('emul_up', function (keyIndex) {
			var key = self.reverseButton(keyIndex);

			self.buttonState[key].pressed = false;
			system.emit('elgato_click', devicepath, key, false, self.buttonState);
		});
	});

	for (var button = 0; button < 15; button++) {
		self.buttonState[button] = {
			pressed: false
		};
	}

	setImmediate(function() {
		system.emit('elgato_ready', devicepath);
	});
}
elgatoEmulator.device_type = 'StreamDeck Emulator';

util.inherits(elgatoEmulator, EventEmitter);

elgatoEmulator.prototype.begin = function() {};
elgatoEmulator.prototype.quit = function () {};

elgatoEmulator.prototype.draw = function(key, buffer) {
	var self = this;

	if (buffer === undefined || buffer.length != 15552) {
		debug("buffer was not 15552, but ", buffer.length);
		return false;
	}

	self.fillImage(self.reverseButton(key), buffer);

	return true;
}

elgatoEmulator.prototype.buttonClear = function(key) {
	var self = this;
	debug('elgatoEmulator.prototype.buttonClear('+key+')')
	var k = self.mapButton(key);
	self.streamDeck.clearKey(k);
}

elgatoEmulator.prototype.isPressed = function(key) {
	var self = this;
	debug('elgatoEmulator.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgatoEmulator.prototype.mapButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	return map[input];
}

elgatoEmulator.prototype.reverseButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}
};

elgatoEmulator.prototype.clearDeck = function() {
	var self = this;
	debug('elgato.prototype.clearDeck()')
	for (var x = 0; x < 15; x++) {
		self.streamDeck.clearKey(x);
	}
}

/* elgato-streamdeck functions */

elgatoEmulator.prototype.fillImage = function (keyIndex, imageBuffer) {
        var self = this;

        if (imageBuffer.length !== 15552) {
                throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length);
        }

        self.keys[keyIndex] = imageBuffer;

        io.emit('emul_fillImage', keyIndex, imageBuffer);
};

elgatoEmulator.prototype.clearKey = function(keyIndex) {
        var self = this;

        self.keys[keyIndex] = Buffer.alloc(15552);

        io.emit('clearKey', keyIndex);
};

elgatoEmulator.prototype.clearAllKeys = function() {
        var self = this;

        for (var i = 0; i < 15; ++i) {

                self.keys[keyIndex] = Buffer.alloc(15552);
                io.emit('clearKey', keyIndex);

        }
};

elgatoEmulator.prototype.setBrightness = function(value) {
        var self = this;
				// No reason to emulate this
};

module.exports = elgatoEmulator;

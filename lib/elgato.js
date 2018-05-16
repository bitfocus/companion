
var path         = require('path');
var streamDeck   = new (require('streamdeck-driver'))();
var util         = require('util');
var fs           = require('fs');
var EventEmitter = require('events').EventEmitter;
var icons = {};

var system;

function elgato(system) {
	var self = this;

	self.buttonState = [];

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;
	self.system = system;

	// send elgato ready message to devices :)
	setImmediate(function() {
		system.emit('elgato_ready');
	});

	streamDeck.on('down', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=true;
		self.system.emit('elgato_click', key, true, self.buttonState);
	});

	streamDeck.on('up', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=false;
		self.system.emit('elgato_click', key, false, self.buttonState);
	});

	streamDeck.on('error', error => {
		console.error(error);
	});

	// Initialize button state hash
	for (var button = 0; button < 15; button++) {
		self.buttonState[button] = {
			needsUpdate: true,
			pressed: false,
		};
	}

	for (var x = 0; x < 15; x++) {
		streamDeck.clearKey(x);
	}

	setImmediate(function(){
		system.emit('ready');
	});

	return self;
}

elgato.prototype.quit = function () {
	var sd = streamDeck;

	if (sd !== undefined) {
		this.clearDeck();
	
		// Find the actual streamdeck driver, to talk to the device directly
		if (sd.device === undefined && sd.streamdeck !== undefined) {
			sd = sd.streamdeck;
		}

		// If an actual streamdeck is connected, disconnect
		if (sd.device !== undefined) {
			sd.device.close();
		}
	}
};

elgato.prototype.draw = function(key, buffer) {
	var self = this;
	if (buffer === undefined || buffer.length != 15552) {
		console.log("buffer was not 15552, but ",buffer.length);
		return false;
	}

	streamDeck.fillImage(self.reverseButton(key), buffer);

	return true;
}


elgato.prototype.isPressed = function(key) {
	var self = this;
	console.log('elgato.prototype.isPressed('+key+')')
	return self.buttonState[key].pressed;
}

elgato.prototype.begin = function() {
	var self = this;
	console.log('elgato.prototype.begin()')
	if (self.timer !== undefined) {
		clearTimeout(self.timer);
	}
	streamDeck.setBrightness(100);
};

elgato.prototype.buttonClear = function(key) {
	var self = this;
	console.log('elgato.prototype.buttonClear('+key+')')
	var k = self.mapButton(key);
	streamDeck.clearKey(k);
}

elgato.prototype.mapButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	return map[input];
}

elgato.prototype.reverseButton = function(input) {
	var self = this;
	var map = "4 3 2 1 0 9 8 7 6 5 14 13 12 11 10".split(/ /);
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return pos;
	}
};

elgato.prototype.clearDeck = function() {
	var self = this;
	console.log('elgato.prototype.clearDeck()')
	for (var x = 0; x < 15; x++) {
		streamDeck.clearKey(x);
	}
}

util.inherits(elgato, EventEmitter);

exports = module.exports = function (system) {
	return new elgato(system);
};

//exports = module.exports = elgato;

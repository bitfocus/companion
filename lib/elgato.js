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
	self.buttonHandler = function(key,state,all) {
		console.log('undefined buttonHandler(key:'+key+',state:'+state+')');
	}

	// Load icon canvas to memory
	/*
	items = fs.readdirSync(__dirname + "/../icons/");
	for (var i=0; i<items.length; i++) {
		self.loadingItems++;
		(function(self, item) {
			fs.readFile(__dirname + '/../icons/' + item, function(err, pngdata){
				self.loadingItems--;
				img = new Image;
				img.src = pngdata;
				icons[item.split(/\./)[0]] = img;
				if (self.loadingItems == 0) {
					self.emit('ready');
				}
			});
		})(self, items[i]);
	};
	*/

	// When ready, tell us what images we've loaded
	self.on('ready', function() {
		console.log("Loaded images:",Object.keys(icons));
	});

	streamDeck.on('down', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=true;
		self.buttonHandler(key, true, self.buttonState);
		self.animationLoop();
	});

	streamDeck.on('up', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=false;
		self.buttonHandler(key, false, self.buttonState);
		self.animationLoop();
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

	setTimeout(function () {
		system.emit('ready');
	}, 100);
	
	return self;
}

elgato.prototype.quit = function () {
	var sd = streamDeck;
	if (sd !== undefined && sd.device !== undefined) {
		sd = sd.streamdeck;
	}
	sd.clearAllKeys();
	sd.device.close();
};


elgato.prototype.animationLoop = function() {
	var self = this;
	console.log('elgato.prototype.animationLoop()');
	self.system.emit('elgato-loop');
}

elgato.prototype.draw = function(key, buffer) {
	var self = this;
	if (buffer === undefined || buffer.length != 15552) {
		console.log("buffer was not 15552, but ",buffer.length);
		return false;
	}

	var sd = streamDeck;
	if (sd !== undefined && sd.device !== undefined) {
		sd = sd.streamdeck;
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

elgato.prototype.setButtonHandler = function(cb) {
	var self = this;
	self.buttonHandler = cb;
};

util.inherits(elgato, EventEmitter);

exports = module.exports = function (system) {
	return new elgato(system);
};

//exports = module.exports = elgato;

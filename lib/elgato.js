var path         = require('path');
var Canvas       = require('canvas');
var Image        = Canvas.Image;
var registerFont = Canvas.registerFont;
var streamDeck   = new (require('streamdeck-driver'))();
var util         = require('util');
var fs           = require('fs');
var EventEmitter = require('events').EventEmitter;
var icons = {};

var system;

function elgato(system) {
	var self = this;

	self.inAnimationLoop = false;
	self.buttonState = [];
	self.buttonHandler = function(key,state) {};

	// How many items we have left to load until we're ready to begin
	self.loadingItems = 0;

	// Load icon canvas to memory
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

	// When ready, tell us what images we've loaded
	self.on('ready', function() {
		console.log("Loaded images:",Object.keys(icons));
	});

	streamDeck.on('down', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=true;
		self.buttonHandler(key, true);
		self.actionButton(key, true);
		self.animationLoop();
	});

	streamDeck.on('up', keyIndex => {
		var key = self.reverseButton(keyIndex);
		self.buttonState[key].pressed=false;
		self.buttonHandler(key, false);
		self.actionButton(key, false);
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
			design: undefined
		};
	}

	for (var x = 0; x < 15; x++) {
		streamDeck.clearKey(x);
	}

	return self;

}

elgato.prototype.quit = function () {
	if (streamDeck !== undefined && streamDeck.streamdeck !== undefined && streamDeck.streamdeck.device !== undefined) {
		streamDeck.streamdeck.clearAllKeys();
		streamDeck.streamdeck.device.close();
	}
	if (streamDeck !== undefined && streamDeck.device !== undefined) {
		streamDeck.clearAllKeys();
		streamDeck.device.close();
	}
};

elgato.prototype.fa = function(info) {
	var self = this;
	var canvas = self.panel.newCanvas();
	var ctx = canvas.getContext('2d');
	ctx.translate(0.5, 0.5);
	ctx.textAlign="center";
	ctx.textBaseline="middle";

	if (info.bgcolor !== undefined) {
		ctx.fillStyle = info.bgcolor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	if (info.bgcolor2 !== undefined) {
		ctx.fillStyle = info.bgcolor2;
		ctx.fillRect(72/2, 0, canvas.width, canvas.height);
	}


	if (info.icon !== undefined) {
			ctx.font= "40px FontAwesome";
			ctx.fillStyle=(info.color !== undefined ? info.color :'white');
			ctx.fillText(info.icon, 72/2,(info.text !== undefined ? 25 : 35));
	}

	if (info.text !== undefined && info.icon !== undefined) {
		ctx.font="15px Helvetica";
		if (info.textcolor !== undefined) ctx.fillStyle=info.textcolor;
		ctx.fillText(info.text, 72/2, 55);
	}

	else if (info.text != undefined && info.icon === undefined) {
		if (info.textsize === undefined) { info.textsize = 40; }
		ctx.font = info.textsize + "px Helvetica";
		if (info.textcolor !== undefined) { ctx.fillStyle=info.textcolor; }
		ctx.fillText(info.text, 72/2, 80/2 );
	}

	return canvas;

}

elgato.prototype.icon = function(info) {

	var self = this;
	var canvas = self.panel.newCanvas();
	var ctx = canvas.getContext('2d');
	ctx.translate(0.5, 0.5);
	ctx.textAlign="center";
	ctx.textBaseline="middle";

	if (info.bgcolor !== undefined) {
		ctx.fillStyle = info.bgcolor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	if (info.bgcolor2 !== undefined) {
		ctx.fillStyle = info.bgcolor2;
		ctx.fillRect(72/2, 0, canvas.width, canvas.height);
	}


	if (info.icon !== undefined && icons[info.icon] !== undefined) {
		ctx.drawImage(icons[info.icon], 0, 0, 72, 72);
	}

	if (info.text !== undefined && info.icon !== undefined) {
		ctx.font="15px Helvetica";
		if (info.textcolor !== undefined) ctx.fillStyle=info.textcolor;
		ctx.fillText(info.text, 72/2, 55);
	}

	else if (info.text != undefined && info.icon === undefined) {
		if (info.textsize === undefined) { info.textsize = 40; }
		ctx.font = info.textsize + "px Helvetica";
		if (info.textcolor !== undefined) { ctx.fillStyle=info.textcolor; }
		ctx.fillText(info.text, 72/2, 80/2 );
	}


	return canvas;
}

elgato.prototype.setButtonHandler = function(handler) {
	var self = this;
	self.buttonHandler = handler;
	return true;
}

elgato.prototype.isPressed = function(key) {
	var self = this;
	return self.buttonState[key].pressed;
}

elgato.prototype.needsUpdate = function(key) {
	var self = this;
	self.buttonState[key].needsUpdate = true;
	return true;
}

elgato.prototype.newCanvas = function() {
	return new Canvas(72, 72);
	//registerFont('./fontawesome.ttf', {family: 'FontAwesome'});
	console.log(registerFont);
};


elgato.prototype.begin = function() {
	var self = this;
	if (self.timer !== undefined) {
		clearTimeout(self.timer);
	}
	streamDeck.setBrightness(100);
	self.timer = setInterval(self.animationLoop, 100, self);
};

elgato.prototype.setDesign = function(button, design) {
	var self = this;
	self.buttonState[button].design = design;
	self.animationLoop();
};

elgato.prototype.canvasToButton = function(button, canvas) {
	var self = this;

	var buffer = canvas.toBuffer('raw');
	var pos = 0;
	var rgb = new Buffer(15552);
	var rgb_pos = 0;

	while(pos < buffer.length) {
		rgb[rgb_pos+2] = buffer[pos++];
		rgb[rgb_pos+1] = buffer[pos++];
		rgb[rgb_pos+0] = buffer[pos++];
		pos++;
		rgb_pos += 3;
	}

	var unique_button = parseInt("" + self.mapButton(button));
	streamDeck.fillImage(unique_button, rgb)

};

elgato.prototype.buttonClear = function(key) {
	var self = this;
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
	for (var x = 0; x < 15; x++) {
		streamDeck.clearKey(x);
	}
}

elgato.prototype.actionButton = function(key, state) {
	var self = this;
};

elgato.prototype.animationLoop = function(obj) {

	var self = obj !== undefined ? obj : this;

	if (self.inAnimationLoop) return;
	self.inAnimationLoop = true;

	for (var button = 0; button < self.buttonState.length; button++) {
		if (self.buttonState[button].needsUpdate) {
			if (self.buttonState[button].design !== undefined) {
				self.buttonState[button].needsUpdate = false;
				var canvas = self.buttonState[button].design(self.buttonState[button]);
				self.canvasToButton(button, canvas);
			}
		}
	}
	self.inAnimationLoop = false;
};

util.inherits(elgato, EventEmitter);

exports = module.exports = function (system) {
	return new elgato(system);
};

//exports = module.exports = elgato;

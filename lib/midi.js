var debug   = require('debug')('lib/midi');
var MIDI     = require('midi');
var util    = require('util');
var EventEmitter = require('events').EventEmitter;

var midi_sockets = [];

const STATUS_UNKNOWN = null;
const STATUS_OK = 0;
const STATUS_WARNING = 1;
const STATUS_ERROR = 2;

// Private function
function new_status(self, status, message) {
	if (self.status != status) {
		self.status = status;
		self.emit('status_change', status, message);
	}
}

function midi(name) {
	var self = this;

	EventEmitter.call(this);

	self.status = undefined;
	self.connected = false;
	self.socket = new midi.input();

	debug('new midi instance asking for portName "'+name+'"');

	for (var i = 0; i < self.socket.getPortCount(); i++) {
		var n = self.socket.getPortName(i);
		debug('found port with name "'+n+'"');
		if (n !== undefined && n === name) {
			debug("it's a match! opening port");
			self.socket.openPort(n);
			self.connected = true;
			new_status(self, STATUS_OK, 'Connected');
		}
	}
	if (self.connected === false) {
		self.retry_timer = setTimeout(function() {
			self.retry();
		}, 2000);
	}

	self.socket.on('error', function (err) {
		// status levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		new_status(self, STATUS_ERROR, error.message);
		self.emit.apply(self, ['error'].concat(Array.from(arguments)));
	});

	input.on('message', function(deltaTime, message) {
		debug("midi message", deltaTime, message);
	});
/*	self.socket.on('listening', function () {
		self.bound = true;
		new_status(self, STATUS_OK);
		self.emit.apply(self, ['listening'].concat(Array.from(arguments)));
	});
*/

	//self.socket.on('data', self.emit.bind(self, 'data'));

	midi_sockets.push(self.socket);
	debug(midi_sockets.length + ' MIDI sockets in use (+1)');

	return self;
}
/*
midi.prototype.send = function(message, cb) {
	var self = this;

	debug('sending ' + (message !== undefined ? message.length : 'undefined') + ' bytes to', self.host, self.port)

	self.socket.send(message, self.port, self.host, function(error){
		if (error) {
			new_status(self, STATUS_ERROR, error.message);
			self.emit.apply(self, ['error'].concat(Array.from(arguments)));

			if (typeof cb == 'function') {
				cb(error);
			}
			return;
		}

		new_status(self, STATUS_OK);

		if (typeof cb == 'function') {
			cb();
		}

	});
};
*/
midi.prototype.destroy = function() {
	var self = this;

	if (retry_timer !== undefined) {
		clearTimeout(retry_timer);
		delete retry_timer;
	}

	if (midi_sockets.indexOf(self.socket) !== -1) {
		midi_sockets.splice(midi_sockets.indexOf(self.socket), 1);
		debug(midi_sockets.length + ' MIDI sockets in use (-1)');
	}

	self.socket.removeAllListeners();
	self.removeAllListeners();
	try {
		self.socket.closePort();
	} catch() {
		debug("closePort failed");
	}
};

util.inherits(midi, EventEmitter);
exports = module.exports = midi;

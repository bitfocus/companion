var debug   = require('debug')('lib/midi_actions');
var util    = require('util');

function midi_actions(system) {
	var self = this;
	self.system = system;

	system.emit('io_get', function (_io) {
		io = _io;
	});

	system.on('midi_msg', function(input, name, cmd, msg) {
		debug("message", name, cmd, msg);
	});

	io.on('connect', function (socket) {
		debug("connect");
	});

}

midi_actions.prototype.save = function() {
	var self = this;
	self.system.emit('db_set', 'midi_actions', self.config);
	self.system.emit('db_save');
};

exports = module.exports = function (system) {
	return new midi_actions(system);
};

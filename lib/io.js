var util    = require("util");
var _io     = require('socket.io');

function io(_system, http) {
	var self = this;

	self.modules = {};
	self.system = _system;

	_io.call(self, http);

	self.system.on('io_get', function (cb) {
		if (typeof cb == 'function') {
			cb(self);
		}
	});

	self.system.on('timer_www', function (time) {
		self.emit('time', time);
	});

	self.initIO();
}
util.inherits(io, _io);

io.prototype.initIO = function() {
	var self = this;

	self.on('connect', function (client) {
		console.log("iomod conn");
	});
};

exports = module.exports = function (_system, http) {
	return new io(_system, http);
};

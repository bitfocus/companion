var debug   = require('debug')('lib/log');

function log(system,io) {
	var self = this;
	self.system = system;
	self.io = io;
	self.history = [];

	self.system.on('log', function(source, level, message) {
		var now = Date.now();
		io.emit('log',now,source,level,message);
		self.history.push([now,source,level,message])
		if (self.history.length > 500) {
			self.history.shift();
		}
	});

	self.io.on('connect', function(client) {
		client.on('log_catchup', function() {
			for (var n in self.history) {
				var arr = self.history[n];
				client.emit('log', arr[0], arr[1], arr[2], arr[3]);
			}
		});
	});

	return self;
}

exports = module.exports = function (system,io) {
	return new log(system,io);
};

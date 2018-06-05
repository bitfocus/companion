var debug   = require('debug')('lib/userconfig');
var system;

function userconfig(system) {
	var self = this;

	self.userconfig = {};

	system.emit('db_get', 'userconfig', function(config) {
		self.userconfig = config;
		for (var key in config) {
			system.emit('userconfig_update', key, config[key]);
		}
	});

	system.on('get_userconfig', function(cb) {
		cb(self.userconfig);
	});

	system.emit('io_get', function (io) {

		io.on('connect', function (socket) {

			debug('socket ' + socket.id + ' connected');

			socket.on('set_userconfig_key', function(key,value) {
				self.userconfig[key] = value;
				debug('-------------- set_userconfig_key', key, value);
				socket.broadcast.emit('set_userconfig_key', key, value);
				system.emit('userconfig_update', key, value);
				system.emit('db_save');
			});

			socket.on('get_userconfig_all', function() {
				socket.emit('get_userconfig_all', self.userconfig);
			});



			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected');
			});

		});
	});

}

module.exports = function (system) {
	return new userconfig(system);
};

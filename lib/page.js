var debug   = require('debug')('lib/page');
var system;

function page(system) {
	var self = this;

	self.page = {};

	system.emit('db_get', 'page', function(config) {
		self.page = config;

		// Default values
		if (self.page === undefined) {
			self.page = {};
			for (var n = 1; n <= 99; n++) {
				if (self.page[''+n] === undefined) {
					self.page[''+n] = {
						name: 'PAGE'
					};
				}
			}
		}

	});

	system.on('get_page', function(cb) {
		cb(self.page);
	});

	system.emit('io_get', function (io) {

		io.on('connect', function (socket) {

			debug('socket ' + socket.id + ' connected');

			socket.on('set_page', function(key,value) {
				self.page[key] = value;
				socket.broadcast.emit('set_page', key, value);
				system.emit('db_set', page, self.page);
				system.emit('page-update', key, value);
				system.emit('db_save');
			});

			socket.on('get_page_all', function() {
				socket.emit('get_page_all', self.page);
			});

			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected');
			});

		});
	});

}

module.exports = function (system) {
	return new page(system);
};

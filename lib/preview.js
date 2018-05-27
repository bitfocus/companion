var debug   = require('debug')('lib/elgatoDM');

var previews = {};





function preview(system, devicepath) {
	var self = this;
	self.type = 'Elgato Streamdeck device';

	self.devicepath = devicepath;
	self.serialnumber = 'preview';

	system.emit('io_get', function (io) {
		io.on('connect', function (socket) {

			debug('socket ' + socket.id + ' connected');

			// Install preview image handler
			socket._previewHandler = self.handlePreview.bind(self, socket);
			socket.on('bank_preview', socket._previewHandler);

			previews[socket.id] = socket;

			socket.on('disconnect', function () {
				socket.removeListener('bank_preview', socket._previewHandler);
				delete socket._previewHandler;
				delete previews[socket.id];
				debug('socket ' + socket.id + ' disconnected');

			});
		});
	});

	system.on('bank-update', self.updateBank.bind(self));
}

preview.prototype.handlePreview = function(socket, page, bank) {
	var self = this;

	if (page === false) {
		debug('socket ' + socket.id + ' removed preview listener');
		socket._preview = undefined;
		return;
	}
	debug('socket ' + socket.id + ' added preview listener for ' + page + ', ' + bank);

	socket._preview = { page: page, bank: bank };
	var img = self.deviceHandler.drawBank(page, bank);
	socket.emit('preview_bank_data', page, bank, img.buffer());
};

preview.prototype.updateBank = function() {
	var self = this;

	for (var key in previews) {
		var socket = previews[key];

		if (socket._preview !== undefined) {
			var img = self.deviceHandler.drawBank(socket._preview.page, socket._preview.bank);
			socket.emit('preview_bank_data', socket._preview.page, socket._preview.bank, img.buffer());
		}
	}
};

/* to be a valid "device" */
preview.prototype.begin = function() {};
preview.prototype.quit = function () {};
preview.prototype.draw = function(key, buffer) {};
preview.prototype.buttonClear = function(key) {};
preview.prototype.clearDeck = function() {};

module.exports = function (system) {
	return new preview(system);
};

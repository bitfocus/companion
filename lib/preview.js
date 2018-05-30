var debug   = require('debug')('lib/preview');
var system;
var previews = {};

function preview(_system) {
	var self = this;

	system = _system;

	system.emit('io_get', function (io) {
		io.on('connect', function (socket) {

			debug('socket ' + socket.id + ' connected');

			// Install preview image handler
			socket._previewHandler = self.handlePreview.bind(self, socket);
			socket.on('bank_preview', socket._previewHandler);

			previews[socket.id] = socket;

			socket._previewPageHandler = self.handlePreviewPage.bind(self, socket);
			socket.on('bank_preview_page', socket._previewPageHandler);

			socket.on('disconnect', function () {
				socket.removeListener('bank_preview', socket._previewHandler);
				socket.removeListener('bank_preview_page', socket._previewPageHandler);

				delete socket._previewHandler;
				delete previews[socket.id];
				debug('socket ' + socket.id + ' disconnected');
			});
		});
	});

	system.on('graphics_bank_invalidated', self.updateBank.bind(self));
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

	system.emit('graphics_get_bank', page, bank, function (img) {
		socket.emit('preview_bank_data', page, bank, img.buffer, img.updated);
	});

};

preview.prototype.handlePreviewPage = function(socket, page, cache) {
	var self = this;
	var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
	var result = {};
	var images;

	system.emit('get_images_for_page', page, function (data) {
		images = data;

		for (var i in b) {
			result[(parseInt(i)+1)] = images[b[i]];
		}
		socket.emit('preview_page_data', result);
	});
};

preview.prototype.updateBank = function(page, bank) {
	var self = this;

	for (var key in previews) {
		var socket = previews[key];

		if (socket._preview !== undefined) {
			if (socket._preview.page == page && socket._preview.bank == bank) {
				system.emit('graphics_get_bank', socket._preview.page, socket._preview.bank, function (img) {
					socket.emit('preview_bank_data', socket._preview.page, socket._preview.bank, img.buffer, img.updated);
				});
			}
		}
	}
};

module.exports = function (system) {
	return new preview(system);
};

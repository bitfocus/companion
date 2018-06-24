var debug   = require('debug')('lib/preview');
var system;
var previews = {};

var graphics;

function preview(_system) {
	var self = this;

	system = _system;

	graphics = new require('./graphics')(system);

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

	var img = graphics.getBank(page, bank);
	socket.emit('preview_bank_data', page, bank, img.buffer, img.updated);
};

preview.prototype.handlePreviewPage = function(socket, page, cache) {
	var self = this;
	var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
	var result = {};

	socket._previewPage = page;

	var images = graphics.getImagesForPage(page);

	for (var i in b) {
		if (cache === undefined || cache[(parseInt(i)+1)] === undefined || cache[(parseInt(i)+1)] != images[b[i]].updated) {
			result[(parseInt(i)+1)] = images[b[i]];
		}
	}

	socket.emit('preview_page_data', result);
};

preview.prototype.updateBank = function(page, bank) {
	var self = this;

	for (var key in previews) {
		var socket = previews[key];

		if (socket._preview !== undefined) {
			if (socket._preview.page == page && socket._preview.bank == bank) {

				var img = graphics.getBank(socket._preview.page, socket._preview.bank);
				socket.emit('preview_bank_data', page, bank, img.buffer, img.updated);

			}
		}

		if (socket._previewPage !== undefined) {
			if (socket._previewPage == page) {
				var result = {};
				var img = graphics.getBank(page, bank);
				result[bank] = img;

				socket.emit('preview_page_data', result);
			}
		}
	}
};

module.exports = function (system) {
	return new preview(system);
};

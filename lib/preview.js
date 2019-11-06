/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var debug   = require('debug')('lib/preview');
var system;
var previews = {};

var graphics;

function preview(_system) {
	var self = this;

	system = _system;
	self.pages = {};

	graphics = new require('./graphics')(system);

	system.emit('io_get', function (io) {
		system.on('io_connect', function (socket) {

			debug('socket ' + socket.id + ' connected');

			// Install preview image handler
			socket._previewHandler = self.handlePreview.bind(self, socket);
			socket.on('bank_preview', socket._previewHandler);

			previews[socket.id] = socket;

			socket._previewPageHandler = self.handlePreviewPage.bind(self, socket);
			socket.on('bank_preview_page', socket._previewPageHandler);

			socket._webButtonsHandler = self.handleWebButtons.bind(self, socket);
			socket.on('web_buttons', socket._webButtonsHandler);

			socket._webButtonsPageHandler = self.handleWebButtonsPage.bind(self, socket);
			socket.on('web_buttons_page', socket._webButtonsPageHandler);

			socket.on('disconnect', function () {
				socket.removeListener('bank_preview', socket._previewHandler);
				socket.removeListener('bank_preview_page', socket._previewPageHandler);
				socket.removeListener('web_buttons', socket._webButtonsHandler);
				socket.removeListener('web_buttons_page', socket._webButtonsPageHandler);

				delete socket._previewHandler;
				delete socket.web_buttons;
				delete previews[socket.id];
				debug('socket ' + socket.id + ' disconnected');
			});
		});
	});

	system.emit('get_page', function (_pages) {
		self.pages = _pages;
	});

	system.on('graphics_bank_invalidated', self.updateBank.bind(self));
}

preview.prototype.handlePreview = function(socket, page, bank) {
	debug("handlePreview()",page,bank);
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

preview.prototype.handleWebButtons = function(socket) {
	debug("handleWebButtons()");
	var self = this;

	socket.web_buttons = 1;
	socket.emit('pages', self.pages);
};

preview.prototype.handleWebButtonsPage = function (socket, page, cache) {
	debug("handleWebButtonsPage()",page);
	var self = this;
	var result = {};

	if (cache === null) return;

	var images = graphics.getImagesForPage(page);
	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		if (cache === undefined || cache[(parseInt(i)+1)] === undefined || cache[(parseInt(i)+1)] != images[i].updated) {
			result[(parseInt(i)+1)] = images[i];
		}
	}

	socket.emit('buttons_page_data', page, result);
}

preview.prototype.handlePreviewPage = function(socket, page, cache) {
	var self = this;
	var result = {};

	socket._previewPage = page;

	var images = graphics.getImagesForPage(page);

	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		if (cache === undefined || cache[(parseInt(i)+1)] === undefined || cache[(parseInt(i)+1)] != images[i].updated) {
			result[(parseInt(i)+1)] = images[i];
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

		if (socket.web_buttons) {
			var result = {};
			var img = graphics.getBank(page, bank);
			result[bank] = img;

			socket.emit('buttons_bank_data', page, result);

		} else
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

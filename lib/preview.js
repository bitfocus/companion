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

class preview {

	constructor(system) {
		this.system = system;
		this.pages = {};
		this.previews = {};

		this.graphics = new require('./graphics')(system);

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {

				debug('client ' + client.id + ' connected');

				// Install preview image handler
				client._previewHandler = this.handlePreview.bind(this, client);
				client.on('bank_preview', client._previewHandler);

				client._schedulerHandler = this.handleSchedule.bind(this, client);
				client.on('scheduler_bank_preview', client._schedulerHandler);
				client._schedulerPreview = [];

				this.previews[client.id] = client;

				client._previewPageHandler = this.handlePreviewPage.bind(this, client);
				client.on('bank_preview_page', client._previewPageHandler);

				client._webButtonsHandler = this.handleWebButtons.bind(this, client);
				client.on('web_buttons', client._webButtonsHandler);

				client._webButtonsPageHandler = this.handleWebButtonsPage.bind(this, client);
				client.on('web_buttons_page', client._webButtonsPageHandler);

				client.on('disconnect', () => {
					client.removeListener('bank_preview', client._previewHandler);
					client.removeListener('bank_preview_page', client._previewPageHandler);
					client.removeListener('web_buttons', client._webButtonsHandler);
					client.removeListener('web_buttons_page', client._webButtonsPageHandler);

					delete client._previewHandler;
					delete client._schedulerHandler;
					delete client.web_buttons;
					delete this.previews[client.id];
					debug('client ' + client.id + ' disconnected');
				});
			});
		});

		this.system.emit('get_page', (_pages) => {
			this.pages = _pages;
		});

		this.system.on('graphics_bank_invalidated', this.updateBank.bind(this));
	}

	handlePreview(client, page, bank) {
		debug("handlePreview()",page,bank);

		if (page === false) {
			debug('client ' + client.id + ' removed preview listener');
			client._preview = undefined;
			return;
		}

		debug('client ' + client.id + ' added preview listener for ' + page + ', ' + bank);

		client._preview = { page: page, bank: bank };

		var img = this.graphics.getBank(page, bank);
		client.emit('preview_bank_data', page, bank, img.buffer, img.updated);
	}

	handlePreviewPage(client, page, cache) {
		var result = {};

		client._previewPage = page;

		var images = this.graphics.getImagesForPage(page);

		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			if (cache === undefined || cache[(parseInt(i)+1)] === undefined || cache[(parseInt(i)+1)] != images[i].updated) {
				result[(parseInt(i)+1)] = images[i];
			}
		}

		client.emit('preview_page_data', result);
	}

	handleSchedule(client, page, bank, stop_watching) {
		client._schedulerPreview = client._schedulerPreview.filter(i => i.page !== page || i.bank !== bank);

		if (!stop_watching) {
			client._schedulerPreview.push({
				page: page,
				bank: bank
			});

			var img = this.graphics.getBank(page, bank);
			client.emit('schedule_preview_data', page, bank, img.buffer, img.updated);
		}
	}

	handleWebButtons(client) {
		debug("handleWebButtons()");

		client.web_buttons = 1;
		client.emit('pages', this.pages);
	}

	handleWebButtonsPage(client, page, cache) {
		debug("handleWebButtonsPage()",page);
		var result = {};

		if (cache === null) {
			return;
		}

		var images = this.graphics.getImagesForPage(page);

		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			if (cache === undefined || cache[(parseInt(i)+1)] === undefined || cache[(parseInt(i)+1)] != images[i].updated) {
				result[(parseInt(i)+1)] = images[i];
			}
		}

		client.emit('buttons_page_data', page, result);
	}

	updateBank(page, bank) {

		for (var key in this.previews) {
			var client = this.previews[key];

			if (client._preview !== undefined) {
				if (client._preview.page == page && client._preview.bank == bank) {

					var img = this.graphics.getBank(client._preview.page, client._preview.bank);
					client.emit('preview_bank_data', page, bank, img.buffer, img.updated);
				}
			}

			if (client._schedulerPreview.find(i => i.bank == bank && i.page == page) !== undefined) {
				var img = this.graphics.getBank(page, bank);
				client.emit('schedule_preview_data', page, bank, img.buffer, img.updated);
			}

			if (client.web_buttons) {
				var result = {};
				var img = this.graphics.getBank(page, bank);
				result[bank] = img;

				client.emit('buttons_bank_data', page, result);
			}
			else if (client._previewPage !== undefined) {
				if (client._previewPage == page) {
					var result = {};
					var img = this.graphics.getBank(page, bank);
					result[bank] = img;

					client.emit('preview_page_data', result);
				}
			}
		}
	}
}

module.exports = function (system) {
	return new preview(system);
};

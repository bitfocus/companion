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

var file_version = 1;

var system;
var shortid = require('shortid');
var debug = require('debug')('lib/loadsave');
var _ = require('lodash');

function loadsave(_system) {
 	var self = this;

	system = self.system = _system;

	system.emit('db_get', 'bank', function(res) {
		self.config = res;
	});

	system.emit('db_get', 'instance', function(res) {
		self.instance = res;
	});

	system.emit('action_get_banks', function (bank_actions) {
		self.bank_actions = bank_actions;
	});

	system.emit('release_action_get_banks', function (bank_release_actions) {
		self.bank_release_actions = bank_release_actions;
	});

	system.emit('feedback_getall', function (feedbacks) {
		self.feedbacks = feedbacks;
	});

	system.on('export_bank', function (page, bank, cb) {
		var exp = {};

		exp.config = _.cloneDeep(self.config[page][bank]);
		exp.instances = {};

		if (self.bank_actions[page] !== undefined) {
			exp.actions = _.cloneDeep(self.bank_actions[page][bank]);
		}

		if (self.bank_release_actions[page] !== undefined) {
			exp.release_actions = _.cloneDeep(self.bank_release_actions[page][bank]);
		}

		if (self.feedbacks[page] !== undefined) {
			exp.feedbacks = _.cloneDeep(self.feedbacks[page][bank]);
		}

		debug('Exported config to bank ' + page + '.' + bank);
		cb(exp);
	});

	system.emit('io_get', function (io) {
		io.on('connect', function (socket) {
			socket.on('loadsave_import_config', function (data) {
				var object;
				try {
					object = JSON.parse(data);
				} catch (e) {
					socket.emit('loadsave_import_config:result', 'File is corrupted or unknown format');
					return;
				}

				if (object.version > file_version) {
					socket.emit('loadsave_import_config:result', 'File was saved with a newer unsupported version of Companion');
					return;
				}

				if (object.type == 'bank') {
					socket.emit('loadsave_import_config:result', 'Cannot load single banks');
					return;
				}

				// rest is done from browser
				socket.emit('loadsave_import_config:result', null, object);
			});
		});
	});

	system.on('import_bank', function (page, bank, imp, cb) {
		system.emit('reset_bank', page, bank);

		// TODO: Rename variable definitions
		self.config[page][bank] = imp.config;

		if (imp.actions !== undefined) {
			if (self.bank_actions[page] === undefined) {
				self.bank_actions[page] = {};
			}
			if (self.bank_actions[page][bank] === undefined) {
				self.bank_actions[page][bank] = [];
			}
			var actions = self.bank_actions[page][bank];

			for (var i = 0; i < imp.actions.length; ++i) {
				var obj = imp.actions[i];
				obj.id = shortid.generate();
				actions.push(obj);
			}
		}

		if (imp.release_actions !== undefined) {
			if (self.bank_release_actions[page] === undefined) {
				self.bank_release_actions[page] = {};
			}
			if (self.bank_release_actions[page][bank] === undefined) {
				self.bank_release_actions[page][bank] = [];
			}
			var actions = self.bank_release_actions[page][bank];

			for (var i = 0; i < imp.release_actions.length; ++i) {
				var obj = imp.release_actions[i];
				obj.id = shortid.generate();
				actions.push(obj);
			}
		}

		if (imp.feedbacks !== undefined) {
			if (self.feedbacks[page] === undefined) {
				self.feedbacks[page] = {};
			}
			if (self.feedbacks[page][bank] === undefined) {
				self.feedbacks[page][bank] = [];
			}
			var feedbacks = self.feedbacks[page][bank];

			for (var i = 0; i < imp.feedbacks.length; ++i) {
				var obj = imp.feedbacks[i];
				obj.id = shortid.generate();
				feedbacks.push(obj);
			}
		}

		system.emit('graphics_invalidate_bank', page, bank);
		system.emit('bank-update', self.config);
		system.emit('feedback_check_bank', page, bank);

		debug('Imported config to bank ' + page + '.' + bank);
		if (typeof cb == 'function') {
			cb();
		}
	});

	function cleanPages(pages) {
		for (var i = 1; i <= 99; ++i) {
			if (pages[i] === undefined) {
				pages[i] = {};
			}

			cleanPage(pages[i]);
		}
		return pages;
	}

	function cleanPage(page) {
		for (var i = 1; i <= 12; ++i) {
			if (page[i] === undefined) {
				page[i] = {};
			}
		}
		return page;
	}

	system.on('http_req', function (req, res, done) {
		var match;

		if (match = req.url.match(/^\/bank_export\/((\d+)\/(\d+))?/)) {
			var page = match[2];
			var bank = match[3];

			if (page === null || bank === null) {
				// 404 handler will take over
				return;
			}

			var exp;
			system.emit('export_bank', page, bank, function (data) {
				exp = data;
			});

			// Export file protocol version
			exp.version = 1;
			exp.type = 'bank';

			exp.instances = {};

			for (var key in exp.actions) {
				var action = exp.actions[key];

				if (exp.instances[action.instance] === undefined) {
					if (self.instance[action.instance] !== undefined) {
						exp.instances[action.instance] = self.instance[action.instance];
					}
				}
			}

			res.writeHeader(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="bank ' + page + '-' + bank + '.companionconfig"' });
			res.end(JSON.stringify(exp));

			done();
		}

		if (match = req.url.match(/^\/page_export\/((\d+))?/)) {
			var page = match[2];

			if (page === null || bank === null) {
				// 404 handler will take over
				return;
			}

			// Export file protocol version
			var exp = {
				version: 1,
				type: 'page'
			};

			exp.config = cleanPage(_.cloneDeep(self.config[page]));
			exp.instances = {};

			exp.actions = self.bank_actions[page];
			exp.release_actions = self.bank_release_actions[page];

			system.emit('get_page', function (page_config) {
				exp.page = page_config[page];
			});

			exp.feedbacks = self.feedbacks[page];

			for (var page in exp.actions) {
				for (var key in exp.actions[page]) {
					var action = exp.actions[page][key];

					if (exp.instances[action.instance] === undefined) {
						if (self.instance[action.instance] !== undefined) {
							exp.instances[action.instance] = self.instance[action.instance];
						}
					}
				}
			}

			res.writeHeader(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="page ' + page + '.companionconfig"' });
			res.end(JSON.stringify(exp));

			done();
		}

		if (match = req.url.match(/^\/full_export/)) {
			// Export file protocol version
			var exp = {
				version: 1,
				type: 'full'
			};

			exp.config = cleanPages(_.cloneDeep(self.config));
			exp.instances = {};

			exp.actions = self.bank_actions;
			exp.actions = self.bank_release_actions;

			system.emit('get_page', function (page_config) {
				exp.page = page_config;
			});

			system.emit('db_get', 'instance', function(res) {
				exp.instances = res;
			});

			exp.feedbacks = self.feedbacks;

			res.writeHeader(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="full config.companionconfig"' });
			res.end(JSON.stringify(exp));

			done();
		}
	});
}

exports = module.exports = loadsave;

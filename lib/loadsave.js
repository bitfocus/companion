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

var system;

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

	system.emit('feedback_getall', function (feedbacks) {
		self.feedbacks = feedbacks;
	});

	system.on('http_req', function (req, res, done) {
		var match;

		if (match = req.url.match(/^\/bank_export\/((\d+)\/(\d+))?/)) {
			var page = match[2];
			var bank = match[3];

			if (page === null || bank === null) {
				// 404 handler will take over
				return;
			}

			// Export file protocol version
			var exp = {
				version: 1,
				type: 'bank'
			};

			exp.config = self.config[page][bank];
			exp.instances = {};

			if (self.bank_actions[page] !== undefined) {
				exp.actions = self.bank_actions[page][bank];
			}

			if (self.feedbacks[page] !== undefined) {
				exp.feedbacks = self.feedbacks[page][bank];
			}

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

			exp.config = self.config[page];
			exp.instances = {};

			exp.actions = self.bank_actions[page];

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

			exp.config = self.config;
			exp.instances = {};

			exp.actions = self.bank_actions;

			system.emit('get_page', function (page_config) {
				exp.page = page_config;
			});

			system.emit('db_get', 'instance', function(res) {
				exp.instances = res;
			});

			exp.feedbacks = self.feedbacks;

			res.writeHeader(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="page ' + page + '.companionconfig"' });
			res.end(JSON.stringify(exp));

			done();
		}
	});
}

exports = module.exports = loadsave;

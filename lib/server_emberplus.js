/*
 * This file is part of the Companion project
 * Copyright (c) 2020 Bitfocus AS
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

var debug = require('debug')('lib/server_emberplus');
var { EmberServer, Model: EmberModel, getPath } = require('emberplus-connection');
var { getPath } = require('emberplus-connection/dist/Ember/Lib/util');

class server_emberplus {

	constructor(system) {
		this.system = system;
		this.pushed = {};

		this.system.emit('skeleton-info-info', (info) => {
			this.companion_info = info;
		});

		this.system.on('graphics_indicate_push', (page, bank, state, deviceid) => {
			if (deviceid === 'emberplus') {
				return;
			}

			this.pushed[page + '_' + bank] = state;

			if (this.server) {
				var path = '0.1.' + page + '.' + bank + '.0';
				var node = this.server.getElementByPath(path);

				// Update ember+ with internal state of button
				if (node) {
					this.server.update(node, { value: state })
				}
			}
		});

		this.system.on('graphics_bank_invalidate', (page, bank) => {
			this.system.emit('log', `Updating ${page}.${bank} label ${this.banks[page][bank].text}`)
			if (this.server) {
				var path = '0.1.' + page + '.' + bank + '.1';
				var node = this.server.getElementByPath(path);

				// Update ember+ with internal state of button
				if (node && node.contents.value !== this.banks[page][bank].text) {
					this.server.update(node, { value: this.banks[page][bank].text || '' })
				}
			}
		});

		this.init();
	}

	getPages() {
		this.pushed = {};

		this.system.emit('get_page', (pages) => {
			this.pages = pages;
		});

		this.system.emit('db_get', 'bank', (banks) => {
			this.banks = banks;

			for (var page in banks) {
				for (var bank in banks[page]) {
					this.pushed[page + '_' + bank] = 0;
				}
			}
		});


		var output = {};

		for (const page in this.pages) {
			const number = parseInt(page);
			const children = {};

			for (var bank in this.banks[page]) {
				const bankNo = parseInt(bank)
				children[bankNo] = new EmberModel.NumberedTreeNodeImpl(bankNo, new EmberModel.EmberNodeImpl(`Bank ${page}.${bank}`), {
					0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.Boolean,
						'State',
						undefined,
						this.pushed[page + '_' + bank] ? true : false,
						undefined,
						undefined,
						EmberModel.ParameterAccess.ReadWrite
					)),
					1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'Label',
						undefined,
						this.banks[page][bank].text || '',
						undefined,
						undefined,
						EmberModel.ParameterAccess.ReadWrite
					)),
				})
			}

			output[number] = new EmberModel.NumberedTreeNodeImpl(
				number,
				new EmberModel.EmberNodeImpl(this.pages[page].name === 'PAGE' ? 'Page ' + page : this.pages[page].name),
				children
			)
		}

		return output;
	}

	init() {
		const root = {
			0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('Companion Tree'), {
				0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('identity'), {
					0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'product',
						undefined,
						'Companion'
					)),
					1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'company',
						undefined,
						'Bitfocus AS'
					)),
					2: new EmberModel.NumberedTreeNodeImpl(2, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'version',
						undefined,
						this.companion_info.appVersion
					)),
					3: new EmberModel.NumberedTreeNodeImpl(3, new EmberModel.ParameterImpl(
						EmberModel.ParameterType.String,
						'build',
						undefined,
						this.companion_info.appBuild
					))
				}),
				1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.EmberNodeImpl('pages'), this.getPages())
			})
		}
		
		var server = this.server = new EmberServer(9092);

		server.onSetValue = (parameter, value) => {
			const path = getPath(parameter)

			if (path.match(/^0\.1\.(\d+\.){2}0/)) {
				var pathInfo = path.split(/\./);

				if (pathInfo.length === 5) {
					var page = parseInt(pathInfo[2]);
					var bank = parseInt(pathInfo[3]);

					if (page > 0 && page < 100) {
						debug("Change bank " + pathInfo[2] + '.' + pathInfo[3] + ' to', value);
						this.system.emit('bank_pressed', pathInfo[2], pathInfo[3], value, 'emberplus');
						server.update(parameter, { value })
						return Promise.resolve(true)
					}
				}
			}
			else if (path.match(/^0\.1\.(\d+\.){2}1/)) {
				var pathInfo = path.split(/\./);

				if (pathInfo.length === 5) {
					var page = parseInt(pathInfo[2]);
					var bank = parseInt(pathInfo[3]);

					if (page > 0 && page < 100) {
						debug("Change bank " + pathInfo[2] + '.' + pathInfo[3] + ' text to', value);

						if (this.banks[page] && this.banks[page][bank]) {
							if (value !== this.banks[page][bank].text) {
								this.system.emit('bank_changefield', page, bank, 'text', value);
								server.update(parameter, { value })
								return Promise.resolve(true)
							}
						}
					}
				}
			}

			return Promise.resolve(false)
		}

		server.init(root)
		// .then(() => {
			debug('Listening on port 9092');
			this.system.emit('log', 'Ember+ Server', 'info', 'Listening for Ember+ on port 9092');
		// }).catch((e) => {
		// 	this.system.emit('log', 'Ember+ Server', 'error', 'Couldn\'t bind to TCP port 9092');
		// 	console.error('ember+: Could not bind to port 9092: ' + e.message);
		// });

		// Handling via promise instead
		server.on('error', (e) => {
			this.system.emit('log', 'Ember+ Server', 'error', 'Couldn\'t bind to TCP port 9092');
			console.error('ember+: Could not bind to port 9092: ' + e.message);
		});
	}
}

exports = module.exports = function (system) {
	return new server_emberplus(system);
};

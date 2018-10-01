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

var debug   = require('debug')('lib/bank');
var fs      = require('fs');

function rgb(r,g,b) {
	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

function bank(system) {
	var self = this;

	self.config = {};

	self.fields = {
		'text': [
			{
				type: 'textinput',
				id: 'text',
				label: 'Button text',
				width: 9,
				default: 'Unnamed'
			},

			{
				type: 'dropdown',
				id: 'size',
				label: 'Font size',
				default: 'auto',
				choices: [
					{ id: '7',    label: '7pt' },
					{ id: '14',   label: '14pt' },
					{ id: '18',   label: '18pt' },
					{ id: '24',   label: '24pt' },
					{ id: '30',   label: '30pt' },
					{ id: '44',   label: '44pt' },
					{ id: 'auto', label: 'Auto'}
				],
				width: 3
			},

			{
				type: 'alignmentcontrol',
				id: 'alignment',
				label: 'Alignment',
				width: 2,
				default: 'center:center'
			},

			{
				type: 'colorpicker',
				id: 'color',
				label: 'Text',
				width: 2,
				default: rgb(255,255,255)
			},

			{
				type: 'colorpicker',
				id: 'bgcolor',
				label: 'Background',
				width: 2,
				default: rgb(0,0,0)
			},

			{
				type: 'checkbox',
				id: 'latch',
				label: 'Latch (toggle)',
				width: 6,
				default: false
			}

		],

		'png': [
			{
				type: 'filepicker',
				id: 'png',
				label: '72x58 PNG',
				accept: 'image/png',
				width: 3,
				imageMinWidth: 72,
				imageMinHeight: 58,
				imageMaxWidth: 72,
				imageMaxHeight: 58
			},

			{
				type: 'alignmentcontrol',
				id: 'pngalignment',
				label: 'PNG Alignment',
				width: 9,
				default: 'center:center'
			},

			{
				type: 'textinput',
				id: 'text',
				label: 'Text',
				width: 9,
				default: ''
			},

			{
				type: 'dropdown',
				id: 'size',
				label: 'Font size',
				default: 'auto',
				choices: [ 
					{ id: '7',    label: '7pt' },
					{ id: '14',   label: '14pt' },
					{ id: '18',   label: '18pt' },
					{ id: '24',   label: '24pt' },
					{ id: '30',   label: '30pt' },
					{ id: '44',   label: '44pt' },
					{ id: 'auto', label: 'Auto'}
				],
				width: 3
			},

			{
				type: 'alignmentcontrol',
				id: 'alignment',
				label: 'Text Alignment',
				width: 2,
				default: 'center:center'
			},

			{
				type: 'colorpicker',
				id: 'color',
				label: 'color',
				width: 2,
				default: rgb(255,255,255)
			},

			{
				type: 'checkbox',
				id: 'latch',
				label: 'Latch (toggle)',
				width: 8,
				default: false
			}
		]
	}

	system.emit('db_get', 'bank', function(res) {
		//debug("LOADING ------------",res);
		if (res !== undefined) {
			self.config = res;

			/* Fix pre-v1.1.0 config for banks */
			for (var page in self.config) {
				for (var bank in self.config[page]) {
					if (self.config[page][bank].style !== undefined && self.config[page][bank].style.match(/^bigtext|smalltext$/)) {
						self.config[page][bank].size = self.config[page][bank].style == 'smalltext' ? 'small' : 'large';
						self.config[page][bank].style = 'text';
					}
				}
			}
		} else {
			for (var x = 1; x <= 99; x++) {
				if (self.config[x] === undefined) {
					self.config[x] = {};
					for (var y = 1; y <= 12; y++) {
						if (self.config[y] === undefined) {
							self.config[x][y] = {};
						}
					}
				}
			}
		}
	});

	/* Variable jiu jitsu */
	system.on('variable_changed', function (label, variable) {
		for (var page in self.config) {
			for (var bank in self.config[page]) {
				var data = self.config[page][bank];
				var reg = new RegExp('\\$\\(' + label + ':' + variable + '\\)');

				if (data.text !== undefined && data.text.match(reg)) {
					debug('variable changed in bank ' + page + '.' + bank);
					system.emit('graphics_invalidate_bank', page, bank);
				}
			}
		}
	});

	system.on('bank-update', function(cfg) {
		debug('bank-update saving');
		self.config = cfg; // in case new reference
		system.emit('db_set', 'bank', cfg );
		system.emit('db_save');
	});

	system.on('bank_set_key', function (page, bank, key, val) {
		if (self.config[page] !== undefined && self.config[page][bank] !== undefined) {
			self.config[page][bank][key] = val;
			system.emit('db_set', 'bank', self.config );
			system.emit('db_save');
		}
	});

	system.emit('io_get', function(io) {

		io.on('connect', function(client) {

			client.on('graphics_generate_preview', function (config, id) {
				system.emit('graphics_generate_preview', config, function (img) {
					client.emit('graphics_generate_preview:' + id, img);
				});
			});

			client.on('reset_bank',function(page,bank) {
				system.emit('reset_bank', page, bank);
				client.emit('reset_bank', page, bank);
			});

			client.on('get_all_banks', function() {
				client.emit('get_all_banks:result', self.config);
			});

			client.on('get_bank', function(page,bank) {

				system.emit('get_bank', page, bank, function(config) {
					var fields = [];
					if (config.style !== undefined && self.fields[config.style] !== undefined) {
						fields = self.fields[config.style];
					}

					client.emit('get_bank:results', page, bank, config, fields);
					system.emit('skeleton-log', 'Running actions for ' + page + '.' + bank + ' - triggered by GUI');

				});
			});

			client.on('hot_press', function(page,button,direction) {
				debug("being told from gui to hot press",page,button,direction);
				system.emit('bank-pressed', page, button, direction);
			});

			client.on('bank_set_png', function (page, bank, dataurl) {
				if (!dataurl.match(/data:.*?image\/png/)) {
					system.emit('skeleton-log', 'Error saving png for bank ' + page + '.' + bank + ". Not a PNG file");
					client.emit('bank_set_png:result', 'error');
					return;
				}

				var data = dataurl.replace(/^.*base64,/,'');
				self.config[page][bank].png64 = data;
				system.emit('bank-update', self.config);

				client.emit('bank_set_png:result', 'ok');
				system.emit('graphics_invalidate_bank', page, bank);
			});

			client.on('bank_changefield', function(page, bank, key, val) {
				self.config[page][bank][key] = val;
				system.emit('bank-update', self.config);
				system.emit('graphics_invalidate_bank', page, bank);
			});

			client.on('bank_copy', function (pagefrom, bankfrom, pageto, bankto) {
				var exp;

				system.emit('export_bank', pagefrom, bankfrom, function (_exp) {
					exp = _exp;
				});

				system.emit('import_bank', pageto, bankto, exp);

				client.emit('bank_copy:result', null, 'ok');
			});

			client.on('bank_move', function (pagefrom, bankfrom, pageto, bankto) {
				var exp;

				system.emit('export_bank', pagefrom, bankfrom, function (_exp) {
					exp = _exp;
				});
				system.emit('import_bank', pageto, bankto, exp);
				system.emit('reset_bank', pagefrom, bankfrom);

				client.emit('bank_move:result', null, 'ok');
			});

			client.on('bank_style', function(page, bank, style) {

				if (self.config[page] === undefined) self.config[page] = {};

				// If there was an image, delete it
				system.emit('configdir_get', function (cfgDir) {
					try {
						fs.unlink(cfgDir + '/banks/' + page + '_' + bank + '.png', function () {});
					} catch (e) {}
				});

				if (style == 'none' || self.config[page][bank] === undefined || self.config[page][bank].style === undefined) {
					self.config[page][bank] = undefined;
				}

				if (style == 'none') {
					client.emit('bank_style:results', page, bank, self.config[page][bank], undefined);
					system.emit('bank-update', self.config, undefined);
					system.emit('graphics_invalidate_bank', page, bank);
					return;
				}

				self.config[page][bank] = {
					style: style
				};

				var fields = [];
				if (self.fields[style] !== undefined) {
					fields = self.fields[style];
				}

				// Install default values
				for (var i = 0; i < fields.length; ++i) {
					if (fields[i].default !== undefined) {
						self.config[page][bank][fields[i].id] = fields[i].default;
					}
				}

				client.emit('bank_style:results', page, bank, self.config[page][bank], fields);
				system.emit('bank-update', self.config, fields);
				system.emit('instance_status_check_bank', page, bank);
				system.emit('graphics_invalidate_bank', page, bank);
			});

		});
	});

	system.on('reset_bank', function(page, bank) {
		if (self.config[page] === undefined) self.config[page] = {};
		self.config[page][bank] = {};
		system.emit('instance_status_check_bank', page, bank);
		system.emit('graphics_invalidate_bank', page, bank);
		system.emit('bank-update', self.config);
	});

	system.on('get_bank', function(page,bank,cb) {
		if (self.config[page] === undefined) cb({});
		else if (self.config[page][bank] === undefined) cb({});
		else cb(self.config[page][bank]);
	});

	system.on('request-bank-update', function() {
		system.emit('bank-update', self.config);
	});

	system.on('ready', function() {
		system.emit('bank-update', self.config);
	});

}

exports = module.exports = function (system) {
	return new bank(system);
};

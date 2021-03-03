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
var _       = require('lodash');
const { SendResult } = require('./resources/utils');

var rgb = function(r, g, b) {
	return (
		((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff)
	);
};

var rgbRev = function(dec) { 
	return  {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: (dec & 0x0000ff)
	};
}

class bank {

	constructor(system) {
		this.system = system
		this.config = {};

		this.fields = {
			'png': [
				{
					type: 'textinput',
					id: 'text',
					label: 'Text',
					width: 6,
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
					type: 'filepicker',
					id: 'png',
					label: '72x58 PNG',
					accept: 'image/png',
					width: 3,
					imageMinWidth: 72,
					imageMinHeight: 58,
					imageMaxWidth: 72,
					imageMaxHeight: 72
				},
				{
					type: 'alignmentcontrol',
					id: 'alignment',
					label: 'Text Alignment',
					width: 2,
					default: 'center:center'
				},
				{
					type: 'alignmentcontrol',
					id: 'pngalignment',
					label: 'PNG Alignment',
					width: 2,
					default: 'center:center'
				},
				{
					type: 'colorpicker',
					id: 'color',
					label: 'Color',
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
					label: 'Latch/Toggle',
					width: 2,
					default: false
				},
				{
					type: 'checkbox',
					id: 'relative_delay',
					label: 'Relative Delays',
					width: 2,
					default: false
				}
			]
		}

		this.system.emit('db_get', 'page_config_version', this.checkVersion.bind(this));

		this.system.emit('db_get', 'bank', this.loadDB.bind(this));

		/* Variable jiu jitsu */
		this.system.on('variable_changed', this.variableChanged.bind(this));

		this.system.on('bank_update', this.updateConfig.bind(this));

		this.system.on('bank_set_key', this.setBankField.bind(this));

		this.system.on('bank_changefield', this.updateBankField.bind(this));

		this.system.on('io_connect', (client) => {

			client.on('graphics_preview_generate', (config, id, answer) => {
				this.system.emit('graphics_preview_generate', config, (img) => {
					SendResult(client, answer, 'graphics_preview_generate:' + id, img);
				});
			});

			client.on('bank_reset', (page, bank) => {
				this.system.emit('bank_reset', page, bank);
				client.emit('bank_reset', page, bank);
			});

			client.on('get_all_banks', () => {
				client.emit('get_all_banks:result', this.config);
			});

			client.on('get_bank', (page, bank, answer) => {

				this.system.emit('get_bank', page, bank, (config) => {
					var fields = [];
					if (config.style !== undefined && this.fields[config.style] !== undefined) {
						fields = this.fields[config.style];
					}

					SendResult(client, answer, 'get_bank:results', page, bank, config, fields);
					this.system.emit('skeleton-log', 'Running actions for ' + page + '.' + bank + ' - triggered by GUI');

				});
			});

			client.on('hot_press', (page, button, direction) => {
				debug("being told from gui to hot press",page,button,direction);
				this.system.emit('bank_pressed', page, button, direction);
			});

			client.on('bank_set_png', (page, bank, dataurl, answer) => {

				if (!dataurl.match(/data:.*?image\/png/)) {
					this.system.emit('skeleton-log', 'Error saving png for bank ' + page + '.' + bank + ". Not a PNG file");
					SendResult(client, answer, 'bank_set_png:result', 'error');
					return;
				}

				var data = dataurl.replace(/^.*base64,/,'');
				this.config[page][bank].png64 = data;
				this.system.emit('bank_update', this.config);

				SendResult(client, answer, 'bank_set_png:result', 'ok');
				this.system.emit('graphics_bank_invalidate', page, bank);
			});

			client.on('bank_changefield', (page, bank, key, val) => {
				this.system.emit('bank_changefield', page, bank, key, val);
			});

			
			client.on('bank_clear_png', function(page, bank) {
				delete this.config[page][bank].png64;
				this.system.emit('bank_update', this.config);

				client.emit('bank_clear_png:result');
				this.system.emit('graphics_bank_invalidate', page, bank);
			});

			client.on('bank_copy', (pagefrom, bankfrom, pageto, bankto) =>{
				if (pagefrom != pageto || bankfrom != bankto) {
					var exp;

					this.system.emit('export_bank', pagefrom, bankfrom, (_exp) => {
						exp = _exp;
					});

					this.system.emit('import_bank', pageto, bankto, exp);
				}

				client.emit('bank_copy:result', null, 'ok');
			});

			client.on('bank_move', (pagefrom, bankfrom, pageto, bankto) => {
				if (pagefrom != pageto || bankfrom != bankto) {
					var exp;

					this.system.emit('export_bank', pagefrom, bankfrom, (_exp) => {
						exp = _exp;
					});

					this.system.emit('import_bank', pageto, bankto, exp);
					this.system.emit('bank_reset', pagefrom, bankfrom);
				}

				client.emit('bank_move:result', null, 'ok');
			});

			client.on('bank_style', (page, bank, style, answer) => {
				this.system.emit('bank_style', page, bank, style, (fields) => {
					SendResult(client, answer, 'bank_style:results', page, bank, this.config[page][bank], fields);
				});
			});

			client.on('disconnect', () => {
				// In theory not needed. But why not.
				client.removeAllListeners('graphics_preview_generate');
				client.removeAllListeners('bank_reset');
				client.removeAllListeners('get_all_banks');
				client.removeAllListeners('get_bank');
				client.removeAllListeners('hot_press');
				client.removeAllListeners('bank_set_png');
				client.removeAllListeners('bank_changefield');
				client.removeAllListeners('bank_copy');
				client.removeAllListeners('bank_move');
				client.removeAllListeners('bank_style');
			});

		});


		this.system.on('bank_style', this.setBankStyle.bind(this));

		this.system.on('bank_reset', this.resetBank.bind(this));

		this.system.on('bank_rename_variables', this.renameVariables.bind(this));

		this.system.on('get_bank', this.getBank.bind(this));

		this.system.on('bank_update_request', () => {
			this.system.emit('bank_update', this.config);
		});

		this.system.on('ready', () => {
			this.system.emit('bank_update', this.config);
		});

		this.system.on('bank_get15to32', (key, cb) => {
			cb(this.convertKey15to32(key));
		});
	}

	checkVersion(res) {
		if (res === undefined || res < 2) {
			// Tell all config loaders to update config to new format
			this.system.emit('15to32');

			for (var page in this.config) {
				for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					if (this.config[page][bank] === undefined) {
						this.config[page][bank] = {};
					}
				}
			}

			// Convert config from 15 to 32 (move banks around to new setup)
			this.system.on('modules_loaded', this.upgrade15to32.bind(this));
		} else if (res > 2) {
			var dialog = require('electron').dialog;
			dialog.showErrorBox('Error starting companion', 'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.');
			process.exit(1);
		}
	}

	convertKey15to32(key) {
		var rows = Math.floor(key / 5);
		var col = (key % 5) + 1;
		var res = (rows * 8) + col;

		if (res >= 32) {
			debug('assert: old config had bigger pages than expected');
			return 31;
		}

		return res;
	}

	exportOldConfig(page, bank) {
		var exp = {};

		exp.config = _.cloneDeep(old_config[page][bank]);
		exp.instances = {};

		if (old_bank_actions[page] !== undefined) {
			exp.actions = _.cloneDeep(old_bank_actions[page][bank]);
		}

		if (old_bank_release_actions[page] !== undefined) {
			exp.release_actions = _.cloneDeep(old_bank_release_actions[page][bank]);
		}

		if (old_feedbacks[page] !== undefined) {
			exp.feedbacks = _.cloneDeep(old_feedbacks[page][bank]);
		}

		return exp;
	}

	getBank(page, bank, cb) {

		if (this.config[page] === undefined) {
			cb({});
		}
		else if (this.config[page][bank] === undefined) {
			cb({});
		}
		else {
			cb(this.config[page][bank]);
		}
	}

	loadDB(res) {
		//debug("LOADING ------------",res);
		if (res !== undefined) {
			this.config = res;

			/* Fix pre-v1.1.0 and pre-v2.0.0 config for banks */
			for (var page in this.config) {
				for (var bank in this.config[page]) {
					if (this.config[page][bank].style !== undefined && this.config[page][bank].style.match(/^bigtext|smalltext$/)) {
						this.config[page][bank].size = this.config[page][bank].style == 'smalltext' ? 'small' : 'large';
						this.config[page][bank].style = 'png';
					}

					if (this.config[page][bank].style !== undefined && this.config[page][bank].style == 'text') {
						this.config[page][bank].style = 'png';
					}
				}
			}
		}
		else {
			for (var x = 1; x <= 99; x++) {
				if (this.config[x] === undefined) {
					this.config[x] = {};

					for (var y = 1; y <= global.MAX_BUTTONS; y++) {
						if (this.config[x][y] === undefined) {
							this.config[x][y] = {};
						}
					}
				}
			}

			this.system.emit('db_set', 'page_config_version', 2);
		}
	}

	renameVariables(from, to) {
		for (var page in this.config) {
			for (var bank in this.config[page]) {
				if (this.config[page][bank].style !== undefined && this.config[page][bank].text !== undefined) {

					this.system.emit('variable_rename_callback', this.config[page][bank].text, from, to, (result) => {

						if (this.config[page][bank].text !== result) {
							debug('rewrote ' +  this.config[page][bank].text + ' to ' + result);
							this.config[page][bank].text = result;
						}
					});
				}
			}
		}
	}

	resetBank(page, bank) {

		if (this.config[page] === undefined) {
			this.config[page] = {};
		}

		this.config[page][bank] = {};
		this.system.emit('instance_status_check_bank', page, bank);
		this.system.emit('graphics_bank_invalidate', page, bank);
		this.system.emit('bank_update', this.config);
	}

	setBankField(page, bank, key, val) {

		if (this.config[page] !== undefined && this.config[page][bank] !== undefined) {
			this.config[page][bank][key] = val;
			this.system.emit('db_set', 'bank', this.config );
			this.system.emit('db_save');
		}
	}

	setBankStyle(page, bank, style, cb) {

		if (this.config[page] === undefined) {
			this.config[page] = {};
		}

		// If there was an image, delete it
		this.system.emit('configdir_get', (cfgDir) => {
			try {
				fs.unlink(cfgDir + '/banks/' + page + '_' + bank + '.png', () => {});
			} catch (e) {}
		});

		if (style == 'none' || this.config[page][bank] === undefined || this.config[page][bank].style === undefined) {
			this.config[page][bank] = undefined;
		}

		if (style == 'none') {
			this.system.emit('bank_update', this.config, undefined);
			this.system.emit('graphics_bank_invalidate', page, bank);
			cb(undefined);
			return;
		}

		else if (style == 'pageup') {
			this.system.emit('bank_reset', page, bank);
		}

		else if (style == 'pagenum') {
			this.system.emit('bank_reset', page, bank);
		}

		else if (style == 'pagedown') {
			this.system.emit('bank_reset', page, bank);
		}

		this.config[page][bank] = {
			style: style
		};

		var fields = [];
		if (this.fields[style] !== undefined) {
			fields = this.fields[style];
		}

		// Install default values
		for (var i = 0; i < fields.length; ++i) {
			if (fields[i].default !== undefined) {
				this.config[page][bank][fields[i].id] = fields[i].default;
			}
		}

		this.system.emit('bank_update', this.config, fields);
		this.system.emit('instance_status_check_bank', page, bank);
		this.system.emit('graphics_bank_invalidate', page, bank);

		if (cb !== undefined) {
			cb(fields);
		}
	}

	updateBankField(page, bank, key, val) {
		this.config[page][bank][key] = val;
		this.system.emit('bank_update', this.config);
		this.system.emit('graphics_bank_invalidate', page, bank);
	}

	updateConfig(cfg) {
		debug('bank_update saving');
		this.config = cfg; // in case new reference
		this.system.emit('db_set', 'bank', cfg );
		this.system.emit('db_save');
	}

	upgrade15to32() {
		var old_config, old_bank_actions, old_bank_release_actions, old_feedbacks;

		this.system.emit('db_get', 'bank', (res) => {
			this.config = res;

			old_config = _.cloneDeep(res);
		});
		this.system.emit('action_get_banks', (bank_actions) => {
			old_bank_actions = _.cloneDeep(bank_actions);
		});

		this.system.emit('release_action_get_banks', (bank_release_actions) => {
			old_bank_release_actions = _.cloneDeep(bank_release_actions);
		});

		this.system.emit('feedback_getall', (feedbacks) => {
			old_feedbacks = _.cloneDeep(feedbacks);
		});

		if (this.config === undefined) {
			this.config = {};
			this.system.emit('db_set', 'bank', this.config);
		}
		if (old_bank_actions === undefined) {
			old_bank_actions = {};
		}
		if (old_bank_actions === undefined) {
			old_bank_actions = {};
		}

		for (var page = 1; page <= 99; ++page) {
			if (this.config[page] === undefined) {
				this.config[page] = {};
			}

			// Reset
			for (var i = 0; i < 32; ++i) {
				this.system.emit('bank_reset', page, i + 1);
			}

			// Add navigation keys
			this.system.emit('import_bank', page, 1, { config: { style: 'pageup' } });
			this.system.emit('import_bank', page, 9, { config: { style: 'pagenum' } });
			this.system.emit('import_bank', page, 17, { config: { style: 'pagedown' } });

			// Move keys around
			for (var b in old_config[page]) {
				var old = this.exportOldConfig(page, b);

				this.system.emit('import_bank', page, this.convertKey15to32(b-1) + 1, old);
			}
		}

		this.system.emit('db_set', 'bank', this.config);
		this.system.emit('db_set', 'page_config_version', 2);
	}

	variableChanged(label, variable) {
		for (var page in this.config) {
			for (var bank in this.config[page]) {
				var data = this.config[page][bank];
				var reg = new RegExp('\\$\\(' + label + ':' + variable + '\\)');

				if (data.text !== undefined && data.text.match(reg)) {
					debug('variable changed in bank ' + page + '.' + bank);
					this.system.emit('graphics_bank_invalidate', page, bank);
				}
			}
		}
	}
}

exports = module.exports = function (system) {
	return new bank(system);
};

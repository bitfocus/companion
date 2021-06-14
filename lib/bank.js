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

var debug = require('debug')('lib/bank')
var fs = require('fs')
var _ = require('lodash')

function rgb(r, g, b) {
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

function rgbRev(dec) {
	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	}
}

function bank(system) {
	var self = this

	self.config = {}

	self.button_default_fields = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		relative_delay: false,
	}

	system.on('bank_upgrade_style', function (config) {
		if (config && config.style) {
			if (config.style == 'bigtext') {
				config.size = 'large'
				config.style = 'png'
			} else if (config.style == 'smalltext') {
				config.size = 'small'
				config.style = 'png'
			} else if (config.style == 'text') {
				config.style = 'png'
			}
			// intentionally a second step
			if (config.style == 'png') {
				config.style = config.latch ? 'step' : 'press'
			}
		}
	})

	system.emit('db_get', 'bank', function (res) {
		//debug("LOADING ------------",res);
		if (res !== undefined) {
			self.config = res

			/* Fix pre-v1.1.0 and pre-v2.0.0 config for banks */
			for (var page in self.config) {
				for (var bank in self.config[page]) {
					system.emit('bank_upgrade_style', self.config[page][bank])
				}
			}
		} else {
			for (var x = 1; x <= 99; x++) {
				if (self.config[x] === undefined) {
					self.config[x] = {}
					for (var y = 1; y <= global.MAX_BUTTONS; y++) {
						if (self.config[x][y] === undefined) {
							self.config[x][y] = {}
						}
					}
				}
			}
			system.emit('db_set', 'page_config_version', 3)
		}
	})

	system.on('get_bank', function (page, bank, cb) {
		if (self.config[page] === undefined) cb({})
		else if (self.config[page][bank] === undefined) cb({})
		else cb(self.config[page][bank])
	})

	system.emit('db_get', 'page_config_version', function (res) {
		if (res === undefined || res < 3) {
			// do the action combination update. this needs to happen before the 15to32, otherwise the actions wont be found for that and will be lost
			system.emit('actions_upgrade_step_structure')
		}

		if (res === undefined || res < 2) {
			// Tell all config loaders to update config to new format
			system.emit('15to32')

			for (var page in self.config) {
				for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					if (self.config[page][bank] === undefined) {
						self.config[page][bank] = {}
					}
				}
			}

			// Convert config from 15 to 32 (move banks around to new setup)
			system.on('modules_loaded', convertConfig15to32)
			res = 2
		}

		if (res > 3) {
			var dialog = require('electron').dialog
			dialog.showErrorBox(
				'Error starting companion',
				'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
			)
			process.exit(1)
		}
	})

	/* Variable jiu jitsu */
	system.on('variables_changed', function (changed_variables, removed_variables) {
		const all_changed_variables = [...removed_variables, ...Object.keys(changed_variables)]

		for (var page in self.config) {
			for (var bank in self.config[page]) {
				var data = self.config[page][bank]

				if (data.text !== undefined) {
					for (const variable of all_changed_variables) {
						if (data.text.includes(`$(${variable})`)) {
							debug('variable changed in bank ' + page + '.' + bank)
							system.emit('graphics_bank_invalidate', page, bank)
							break
						}
					}
				}
			}
		}
	})

	system.on('bank_update', function (cfg) {
		debug('bank_update saving')
		self.config = cfg // in case new reference
		system.emit('db_set', 'bank', cfg)
		system.emit('db_save')
	})

	system.on('bank_set_key', function (page, bank, key, val) {
		if (self.config[page] !== undefined && self.config[page][bank] !== undefined) {
			self.config[page][bank][key] = val
			system.emit('db_set', 'bank', self.config)
			system.emit('db_save')
		}
	})

	system.on('bank_changefield', function (page, bank, key, val) {
		self.config[page][bank][key] = val
		system.emit('bank_update', self.config)
		system.emit('graphics_bank_invalidate', page, bank)
	})

	system.on('io_connect', function (client) {
		function sendResult(answer, name, ...args) {
			if (typeof answer === 'function') {
				answer(...args)
			} else {
				client.emit(name, ...args)
			}
		}

		client.on('graphics_preview_generate', function (config, answer) {
			system.emit('graphics_preview_generate', config, function (img) {
				answer(img)
			})
		})

		client.on('bank_reset', function (page, bank) {
			system.emit('bank_reset', page, bank)
			client.emit('bank_reset', page, bank)
		})

		client.on('get_all_banks', function () {
			client.emit('get_all_banks:result', self.config)
		})

		client.on('get_bank', function (page, bank, answer) {
			system.emit('get_bank', page, bank, function (config) {
				sendResult(answer, 'get_bank:results', page, bank, config)
			})
		})

		client.on('hot_press', function (page, button, direction) {
			debug('being told from gui to hot press', page, button, direction)
			system.emit('bank_pressed', page, button, direction)
		})

		client.on('bank_set_png', function (page, bank, dataurl, answer) {
			if (!dataurl.match(/data:.*?image\/png/)) {
				sendResult(answer, 'bank_set_png:result', 'error')
				return
			}

			var data = dataurl.replace(/^.*base64,/, '')
			self.config[page][bank].png64 = data
			system.emit('bank_update', self.config)

			sendResult(answer, 'bank_set_png:result', 'ok')
			system.emit('graphics_bank_invalidate', page, bank)
		})

		client.on('bank_clear_png', function (page, bank) {
			delete self.config[page][bank].png64
			system.emit('bank_update', self.config)

			client.emit('bank_clear_png:result')
			system.emit('graphics_bank_invalidate', page, bank)
		})

		client.on('bank_changefield', function (page, bank, key, val) {
			system.emit('bank_changefield', page, bank, key, val)
		})

		client.on('bank_copy', function (pagefrom, bankfrom, pageto, bankto) {
			if (pagefrom != pageto || bankfrom != bankto) {
				var exp

				system.emit('export_bank', pagefrom, bankfrom, function (_exp) {
					exp = _exp
				})

				system.emit('import_bank', pageto, bankto, exp)
			}

			client.emit('bank_copy:result', null, 'ok')
		})

		client.on('bank_move', function (pagefrom, bankfrom, pageto, bankto) {
			if (pagefrom != pageto || bankfrom != bankto) {
				var exp

				system.emit('export_bank', pagefrom, bankfrom, function (_exp) {
					exp = _exp
				})
				system.emit('import_bank', pageto, bankto, exp)
				system.emit('bank_reset', pagefrom, bankfrom)
			}

			client.emit('bank_move:result', null, 'ok')
		})

		client.on('bank_style', function (page, bank, style, answer) {
			system.emit('bank_style', page, bank, style, function () {
				sendResult(answer, 'bank_style:results', page, bank, self.config[page][bank])
			})
		})

		client.on('disconnect', function () {
			// In theory not needed. But why not.
			client.removeAllListeners('graphics_preview_generate')
			client.removeAllListeners('bank_reset')
			client.removeAllListeners('get_all_banks')
			client.removeAllListeners('get_bank')
			client.removeAllListeners('hot_press')
			client.removeAllListeners('bank_set_png')
			client.removeAllListeners('bank_changefield')
			client.removeAllListeners('bank_copy')
			client.removeAllListeners('bank_move')
			client.removeAllListeners('bank_style')
		})
	})

	system.on('bank_style', function (page, bank, style, cb) {
		if (self.config[page] === undefined) self.config[page] = {}

		// If there was an image, delete it
		system.emit('configdir_get', function (cfgDir) {
			try {
				fs.unlink(cfgDir + '/banks/' + page + '_' + bank + '.png', function () {})
			} catch (e) {}
		})

		if (style == 'none' || self.config[page][bank] === undefined || self.config[page][bank].style === undefined) {
			self.config[page][bank] = undefined
		}

		if (style == 'none') {
			system.emit('bank_update', self.config)
			system.emit('action_setup_bank', page, bank, null)
			system.emit('graphics_bank_invalidate', page, bank)
			system.emit('bank_style_changed', page, bank)
			cb(undefined)
			return
		} else if (style == 'pageup') {
			system.emit('bank_reset', page, bank)
		} else if (style == 'pagenum') {
			system.emit('bank_reset', page, bank)
		} else if (style == 'pagedown') {
			system.emit('bank_reset', page, bank)
		}

		self.config[page][bank] = {
			style: style,
		}

		// Install default values
		self.config[page][bank] = {
			...self.config[page][bank],
			...self.button_default_fields,
		}

		system.emit('bank_update', self.config)
		system.emit('action_setup_bank', page, bank, style)
		system.emit('instance_status_check_bank', page, bank)
		system.emit('graphics_bank_invalidate', page, bank)
		system.emit('bank_style_changed', page, bank)

		if (cb !== undefined) {
			cb()
		}
	})

	system.on('bank_reset', function (page, bank) {
		if (self.config[page] === undefined) self.config[page] = {}
		self.config[page][bank] = {}
		system.emit('instance_status_check_bank', page, bank)
		system.emit('graphics_bank_invalidate', page, bank)
		system.emit('action_setup_bank', page, bank, null)
		system.emit('bank_update', self.config)
		system.emit('bank_style_changed', page, bank)
	})

	system.on('bank_rename_variables', function (from, to) {
		for (var page in self.config) {
			for (var bank in self.config[page]) {
				if (self.config[page][bank].style !== undefined && self.config[page][bank].text !== undefined) {
					system.emit('variable_rename_callback', self.config[page][bank].text, from, to, function (result) {
						if (self.config[page][bank].text !== result) {
							debug('rewrote ' + self.config[page][bank].text + ' to ' + result)
							self.config[page][bank].text = result
						}
					})
				}
			}
		}
	})

	system.on('get_banks_for_page', function (page, cb) {
		if (self.config[page] === undefined) cb({})
		else cb(self.config[page])
	})

	system.on('bank_update_request', function () {
		system.emit('bank_update', self.config)
	})

	system.on('ready', function () {
		system.emit('bank_update', self.config)
	})

	function from15to32(key) {
		key = key - 1

		var rows = Math.floor(key / 5)
		var col = (key % 5) + 1
		var res = rows * 8 + col

		if (res >= 32) {
			debug('assert: old config had bigger pages than expected')
			return 31
		}
		return res
	}
	function from12to32(key) {
		key = key - 1

		var rows = Math.floor(key / 4)
		var col = (key % 4) + 2
		var res = rows * 8 + col

		if (res >= 32) {
			debug('assert: old config had bigger pages than expected')
			return 31
		}
		return res
	}

	system.on('bank_get15to32', function (key, cb) {
		cb(from15to32(key))
	})
	system.on('bank_get12to32', function (key, cb) {
		cb(from12to32(key))
	})

	function convertConfig15to32() {
		var old_config, old_bank_action_sets, old_feedbacks

		system.emit('db_get', 'bank', function (res) {
			self.config = res

			old_config = _.cloneDeep(res)
		})
		system.emit('action_get_bank_sets', function (bank_action_sets) {
			old_bank_action_sets = _.cloneDeep(bank_action_sets)
		})

		system.emit('feedback_getall', function (feedbacks) {
			old_feedbacks = _.cloneDeep(feedbacks)
		})

		if (self.config === undefined) {
			self.config = {}
			system.emit('db_set', 'bank', self.config)
		}
		if (old_bank_action_sets === undefined) {
			old_bank_action_sets = {}
		}

		for (var page = 1; page <= 99; ++page) {
			if (self.config[page] === undefined) {
				self.config[page] = {}
			}

			// Reset
			for (var i = 0; i < 32; ++i) {
				system.emit('bank_reset', page, i + 1)
			}

			// Add navigation keys
			system.emit('import_bank', page, 1, { config: { style: 'pageup' } })
			system.emit('import_bank', page, 9, { config: { style: 'pagenum' } })
			system.emit('import_bank', page, 17, { config: { style: 'pagedown' } })

			// Move keys around
			for (var b in old_config[page]) {
				var old = exportOldConfig(page, b)

				system.emit('import_bank', page, from12to32(b), old)
			}
		}

		system.emit('db_set', 'bank', self.config)
		system.emit('db_set', 'page_config_version', 3)

		function exportOldConfig(page, bank) {
			var exp = {}

			exp.config = _.cloneDeep(old_config[page][bank])
			exp.instances = {}

			if (old_bank_action_sets[page] !== undefined) {
				exp.action_sets = _.cloneDeep(old_bank_action_sets[page][bank])
			}

			if (old_feedbacks[page] !== undefined) {
				exp.feedbacks = _.cloneDeep(old_feedbacks[page][bank])
			}

			return exp
		}
	}

	system.emit('bank_ready')
}

exports = module.exports = function (system) {
	return new bank(system)
}

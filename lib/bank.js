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
var path = require('path')
var _ = require('lodash')
const rimraf = require('rimraf')

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

	system.emit('db_get', 'bank', function (res) {
		//debug("LOADING ------------",res);
		self.config = res || {}

		// Upgrade legacy png files if they exist. pre v1.2.0
		let cfgDir
		system.emit('configdir_get', function (_cfgDir) {
			cfgDir = _cfgDir
		})
		if (fs.existsSync(path.join(cfgDir, 'banks'))) {
			for (var page in self.config) {
				if (self.config[page]) {
					for (var bank in self.config[page]) {
						if (self.config[page][bank] && self.config[page][bank].style) {
							const fullPath = path.join(cfgDir, 'banks', `${page}_${bank}.png`)
							try {
								if (fs.existsSync(fullPath)) {
									const data = fs.readFileSync(fullPath, 'base64')
									self.config[page][bank].png64 = data
								}
							} catch (e) {
								debug('Error upgrading config to inline png for bank ' + page + '.' + bank)
								debug('Reason:' + e.message)
							}
						}
					}
				}
			}

			system.emit('db_set', 'bank', self.config)
			system.emit('db_save')

			// Delete old files
			rimraf(path.join(cfgDir, 'banks'), function (err) {
				debug('Error cleaning up legacy pngs banks')
				debug('Reason:' + err)
			})
		}

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
	})

	system.on('get_bank', function (page, bank, cb) {
		if (self.config[page] === undefined) cb({})
		else if (self.config[page][bank] === undefined) cb({})
		else cb(self.config[page][bank])
	})

	/* Variable jiu jitsu */
	system.on('variables_changed', function (changed_variables, removed_variables) {
		const all_changed_variables = [...removed_variables, ...Object.keys(changed_variables)]

		if (all_changed_variables.length > 0) {
			for (var page in self.config) {
				for (var bank in self.config[page]) {
					var data = self.config[page][bank]

					let text = data.text
					system.emit('feedback_get_style', page, bank, function (style) {
						if (style !== undefined) {
							if (typeof style.text === 'string') {
								text = style.text
							}
						}
					})

					if (typeof text === 'string') {
						for (const variable of all_changed_variables) {
							if (text.includes(`$(${variable})`)) {
								debug('variable changed in bank ' + page + '.' + bank)
								system.emit('graphics_bank_invalidate', page, bank)
								break
							}
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

	system.on('bank_get15to32', function (key, cb) {
		cb(from15to32(key))
	})

	system.emit('bank_ready')
}

exports = module.exports = function (system) {
	return new bank(system)
}

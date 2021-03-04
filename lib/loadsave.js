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

var file_version = 2

var system
var shortid = require('shortid')
var debug = require('debug')('lib/loadsave')
var os = require('os')
var _ = require('lodash')

var util = require('util')

function loadsave(_system) {
	var self = this

	system = self.system = _system

	system.emit('db_get', 'bank', function (res) {
		self.config = res
	})

	system.emit('db_get', 'instance', function (res) {
		self.instance = res
	})

	system.emit('action_get_banks', function (bank_actions) {
		self.bank_actions = bank_actions
	})

	system.emit('release_action_get_banks', function (bank_release_actions) {
		self.bank_release_actions = bank_release_actions
	})

	system.emit('feedback_getall', function (feedbacks) {
		self.feedbacks = feedbacks
	})

	system.on('export_bank', function (page, bank, cb) {
		var exp = {}

		exp.config = _.cloneDeep(self.config[page][bank])
		exp.instances = {}

		if (self.bank_actions[page] !== undefined) {
			exp.actions = _.cloneDeep(self.bank_actions[page][bank])
		}

		if (self.bank_release_actions[page] !== undefined) {
			exp.release_actions = _.cloneDeep(self.bank_release_actions[page][bank])
		}

		if (self.feedbacks[page] !== undefined) {
			exp.feedbacks = _.cloneDeep(self.feedbacks[page][bank])
		}

		debug('Exported config to bank ' + page + '.' + bank)
		cb(exp)
	})

	function variable_rename(str, fromname, toname) {
		var result

		system.emit('variable_rename_callback', str, fromname, toname, function (res) {
			result = res
		})

		return result
	}

	function convert15to32(obj) {
		var newobj = {}
		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			newobj[i + 1] = []
		}

		for (var bank in obj) {
			system.emit('bank_get15to32', parseInt(bank), function (_bank) {
				newobj[_bank] = obj[bank]
			})
		}

		return newobj
	}

	// Convert config from older versions of companion
	// Commence backwards compatibility!
	function version_check(obj) {
		// Version 1 = 15 keys, Version 2 = 32 keys
		if (obj.version === 1) {
			if (obj.type == 'full') {
				console.log('FULL CONFIG; do conversion for each page')
				for (var page in obj.page) {
					var data = { type: 'page', version: 1 }

					if (obj.actions === undefined) {
						obj.actions = {}
					}

					if (obj.release_actions === undefined) {
						obj.release_actions = {}
					}

					if (obj.feedbacks === undefined) {
						obj.feedbacks = {}
					}

					data.page = obj.page[page]
					data.config = obj.config[page]
					data.actions = obj.actions[page]
					data.release_actions = obj.release_actions[page]
					data.feedbacks = obj.feedbacks[page]

					console.log('Recursive convert page ' + page, data)
					var newdata = version_check(data)
					console.log('Converted to ', newdata)

					obj.page[page] = newdata.page
					obj.config[page] = newdata.config
					obj.actions[page] = newdata.actions
					obj.release_actions[page] = newdata.release_actions
					obj.feedbacks[page] = newdata.feedbacks
				}

				return obj
			}

			console.log('Single page convert', obj)
			var data = {}

			data.page = obj.page

			// Banks
			data.config = convert15to32(obj.config)
			data.config[1] = { style: 'pageup' }
			data.config[9] = { style: 'pagenum' }
			data.config[17] = { style: 'pagedown' }

			// Actions
			data.actions = convert15to32(obj.actions)

			// Release actions
			data.release_actions = convert15to32(obj.release_actions)

			// Feedbacks
			data.feedbacks = convert15to32(obj.feedbacks)

			console.log('Converted')
			return data
		}

		// Version 2 == no changes needed
		return obj
	}

	system.emit('io_get', function (io) {
		system.on('io_connect', function (socket) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					socket.emit(name, ...args)
				}
			}

			socket.on('loadsave_import_config', function (data, answer) {
				var object
				try {
					object = JSON.parse(data)
				} catch (e) {
					sendResult(answer, 'loadsave_import_config:result', 'File is corrupted or unknown format')
					return
				}

				if (object.version > file_version) {
					sendResult(
						answer,
						'loadsave_import_config:result',
						'File was saved with a newer unsupported version of Companion'
					)
					return
				}

				if (object.type == 'bank') {
					sendResult(answer, 'loadsave_import_config:result', 'Cannot load single banks')
					return
				}

				object = version_check(object)

				// rest is done from browser
				sendResult(answer, 'loadsave_import_config:result', null, object)
			})

			socket.on('loadsave_reset_page_all', function (page) {
				for (var i = 1; i <= global.MAX_BUTTONS; ++i) {
					console.log('RESET BANK', page, i)
					system.emit('bank_reset', page, i)
				}

				// make magical page buttons!
				system.emit('bank_style', page, 1, 'pageup')
				system.emit('bank_style', page, 9, 'pagenum')
				system.emit('bank_style', page, 17, 'pagedown')
				system.emit('page_set', page, { name: 'PAGE' })

				socket.emit('loadsave_reset_page:reset', null, 'ok')
			})

			socket.on('loadsave_reset_page_nav', function (page) {
				// reset nav banks
				system.emit('bank_reset', page, 1)
				system.emit('bank_reset', page, 9)
				system.emit('bank_reset', page, 17)

				// make magical page buttons!
				system.emit('bank_style', page, 1, 'pageup')
				system.emit('bank_style', page, 9, 'pagenum')
				system.emit('bank_style', page, 17, 'pagedown')

				system.emit('page_set', page, { name: 'PAGE' })

				socket.emit('loadsave_reset_page:reset', null, 'ok')
			})

			socket.on('reset_all', function (answer) {
				for (var page = 1; page <= 99; ++page) {
					system.emit('page_set', page, { name: 'PAGE' })

					for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
						system.emit('bank_reset', page, bank)
					}
				}

				for (var key in self.instance) {
					if (key != 'bitfocus-companion' && self.instance[key].instance_type != 'bitfocus-companion') {
						system.emit('instance_delete', key, self.instance[key].label)
					}
				}

				sendResult(answer, 'reset_all:result', null, 'ok')
			})

			socket.on('loadsave_import_full', function (data, answer) {
				// Support for reading erroneous exports from pre-release
				if (data.bank_release_actions !== undefined) {
					data.release_actions = data.bank_release_actions
					delete data.bank_release_actions
				}

				for (var page = 1; page <= 99; ++page) {
					for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
						system.emit('bank_reset', page, bank)
					}
				}

				for (var key in self.instance) {
					if (key != 'bitfocus-companion' && self.instance[key].instance_type != 'bitfocus-companion') {
						system.emit('instance_delete', key, self.instance[key].label)
					}
				}

				for (var key in data.instances) {
					if (key == 'bitfocus-companion' || data.instances[key].instance_type == 'bitfocus-companion') {
						delete data.instances[key]
						continue
					}

					self.instance[key] = data.instances[key]
					if (data.instances[key].enabled) {
						system.emit('instance_activate', key)
					}
				}

				for (var page = 1; page <= 99; ++page) {
					if (data.page !== undefined && data.page[page] !== undefined) {
						system.emit('page_set_noredraw', page, data.page[page])
					} else {
						system.emit('page_set_noredraw', page, { name: 'PAGE' })
					}

					for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
						var obj = {}

						obj.config = data.config[page][bank]

						if (
							data.actions !== undefined &&
							data.actions[page] !== undefined &&
							data.actions[page][bank] !== undefined
						) {
							obj.actions = data.actions[page][bank]
						} else {
							obj.actions = []
						}

						if (
							data.release_actions !== undefined &&
							data.release_actions[page] !== undefined &&
							data.release_actions[page][bank] !== undefined
						) {
							obj.release_actions = data.release_actions[page][bank]
						} else {
							obj.release_actions = []
						}

						if (
							data.feedbacks !== undefined &&
							data.feedbacks[page] !== undefined &&
							data.feedbacks[page][bank] !== undefined
						) {
							obj.feedbacks = data.feedbacks[page][bank]
						} else {
							obj.feedbacks = []
						}

						system.emit('import_bank', page, bank, obj)
					}
				}

				sendResult(answer, 'loadsave_import_full:result', null, 'ok')
			})

			socket.on('loadsave_import_page', function (topage, frompage, data) {
				// Support for reading erroneous exports from pre-release
				if (data.bank_release_actions !== undefined) {
					data.release_actions = data.bank_release_actions
					delete data.bank_release_actions
				}

				if (data.type == 'full') {
					data.page = data.page[frompage]
					data.config = data.config[frompage]
					data.actions = data.actions === undefined ? {} : data.actions[frompage]
					data.release_actions = data.release_actions === undefined ? {} : data.release_actions[frompage]
					data.feedbacks = data.feedbacks === undefined ? {} : data.feedbacks[frompage]
				}

				if (data.page !== undefined) {
					system.emit('page_set', topage, data.page)
				} else {
					system.emit('page_set', topage, { name: 'PAGE' })
				}

				for (var i = 1; i <= global.MAX_BUTTONS; ++i) {
					system.emit('bank_reset', topage, i)
				}

				for (var key in data.instances) {
					if (key != 'bitfocus-companion' && data.instances[key].import_to == 'new') {
						var type = data.instances[key].instance_type
						var product = data.instances[key].product
						system.emit('instance_add', { type, product }, function (id, config) {
							data.instances[key].import_to = id

							for (var i in data.instances[key]) {
								if (i != 'label') {
									config[i] = data.instances[key][i]
								}
							}

							system.emit('instance_config_put', id, config)
						})
					}

					for (var bank in data.config) {
						data.config[bank].text = variable_rename(
							data.config[bank].text,
							data.instances[key].label,
							self.instance[data.instances[key].import_to].label
						)
					}

					for (var bank in data.actions) {
						for (var i = 0; i < data.actions[bank].length; ++i) {
							var act = data.actions[bank][i]

							if (act.instance == key) {
								act.instance = data.instances[key].import_to
								act.label = act.instance + ':' + act.action
							}
						}
					}

					for (var bank in data.release_actions) {
						for (var i = 0; i < data.release_actions[bank].length; ++i) {
							var act = data.release_actions[bank][i]

							if (act.instance == key) {
								act.instance = data.instances[key].import_to
								act.label = act.instance + ':' + act.action
							}
						}
					}

					for (var bank in data.feedbacks) {
						for (var i = 0; i < data.feedbacks[bank].length; ++i) {
							var act = data.feedbacks[bank][i]

							if (act.instance_id == key) {
								act.instance_id = data.instances[key].import_to
							}
						}
					}
				}

				for (var bank in data.config) {
					var obj = {}
					obj.config = data.config !== undefined ? data.config[bank] : {}
					obj.actions = data.actions !== undefined ? data.actions[bank] : []
					obj.release_actions = data.release_actions !== undefined ? data.release_actions[bank] : []
					obj.feedbacks = data.feedbacks !== undefined ? data.feedbacks[bank] : []

					system.emit('import_bank', topage, bank, obj)
				}
			})
		})
	})

	system.on('import_bank', function (page, bank, imp, cb) {
		system.emit('bank_reset', page, bank)

		if (imp.config === undefined) {
			// this should technically throw an exception
			imp.config = {}
		}

		if (imp.config.style !== undefined && imp.config.style == 'text') {
			// v2.0.0: 'text' button style is now 'png'
			imp.config.style = 'png'
		}

		// TODO: Rename variable definitions
		self.config[page][bank] = imp.config

		if (imp.actions !== undefined) {
			if (self.bank_actions[page] === undefined) {
				self.bank_actions[page] = {}
			}
			if (self.bank_actions[page][bank] === undefined) {
				self.bank_actions[page][bank] = []
			}
			var actions = self.bank_actions[page][bank]

			for (var i = 0; i < imp.actions.length; ++i) {
				var obj = imp.actions[i]
				obj.id = shortid.generate()
				actions.push(obj)
			}
		}

		if (imp.release_actions !== undefined) {
			if (self.bank_release_actions[page] === undefined) {
				self.bank_release_actions[page] = {}
			}
			if (self.bank_release_actions[page][bank] === undefined) {
				self.bank_release_actions[page][bank] = []
			}
			var release_actions = self.bank_release_actions[page][bank]

			for (var i = 0; i < imp.release_actions.length; ++i) {
				var obj = imp.release_actions[i]
				obj.id = shortid.generate()
				release_actions.push(obj)
			}
		}

		if (imp.feedbacks !== undefined) {
			if (self.feedbacks[page] === undefined) {
				self.feedbacks[page] = {}
			}
			if (self.feedbacks[page][bank] === undefined) {
				self.feedbacks[page][bank] = []
			}
			var feedbacks = self.feedbacks[page][bank]

			for (var i = 0; i < imp.feedbacks.length; ++i) {
				var obj = imp.feedbacks[i]
				obj.id = shortid.generate()
				feedbacks.push(obj)
			}
		}

		system.emit('graphics_bank_invalidate', page, bank)
		system.emit('bank_update', self.config)
		system.emit('feedback_check_bank', page, bank)
		system.emit('feedback_subscribe_bank', page, bank)
		system.emit('action_subscribe_bank', page, bank)

		system.emit('action_save')
		system.emit('release_action_save')
		system.emit('feedback_save')
		system.emit('db_save')

		debug('Imported config to bank ' + page + '.' + bank)
		if (typeof cb == 'function') {
			cb()
		}
	})

	function cleanPages(pages) {
		for (var i = 1; i <= 99; ++i) {
			if (pages[i] === undefined) {
				pages[i] = {}
			}

			cleanPage(pages[i])
		}
		return pages
	}

	function cleanPage(page) {
		for (var i = 1; i <= global.MAX_BUTTONS; ++i) {
			if (page[i] === undefined) {
				page[i] = {}
			}
		}
		return page
	}

	function convert2Digit(num) {
		if (num < 10) {
			num = '0' + num
		}
		return num
	}

	function getTimestamp() {
		var d = new Date()
		var year = d.getFullYear().toString()
		var month = convert2Digit(d.getMonth() + 1)
		var day = convert2Digit(d.getDate())
		var hrs = convert2Digit(d.getHours())
		var mins = convert2Digit(d.getMinutes())
		var out = year + month + day + '-' + hrs + mins
		return out
	}

	system.on('http_req', function (req, res, done) {
		var match

		if ((match = req.url.match(/^\/bank_export\/((\d+)\/(\d+))?/))) {
			var page = match[2]
			var bank = match[3]

			if (page === null || bank === null) {
				// 404 handler will take over
				return
			}

			var exp
			system.emit('export_bank', page, bank, function (data) {
				exp = data
			})

			// Export file protocol version
			exp.version = file_version
			exp.type = 'bank'

			exp.instances = {}

			for (var key in exp.actions) {
				var action = exp.actions[key]

				if (exp.instances[action.instance] === undefined) {
					if (self.instance[action.instance] !== undefined) {
						exp.instances[action.instance] = self.instance[action.instance]
					}
				}
			}

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' +
					os.hostname() +
					'_bank ' +
					page +
					'-' +
					bank +
					'_' +
					getTimestamp() +
					'.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}

		if ((match = req.url.match(/^\/page_export\/((\d+))?/))) {
			var page = match[2]

			if (page === null || bank === null) {
				// 404 handler will take over
				return
			}

			// Export file protocol version
			var exp = {
				version: file_version,
				type: 'page',
			}

			exp.config = cleanPage(_.cloneDeep(self.config[page]))
			exp.instances = {}

			exp.actions = self.bank_actions[page]
			exp.release_actions = self.bank_release_actions[page]

			system.emit('get_page', function (page_config) {
				exp.page = page_config[page]
			})

			exp.feedbacks = self.feedbacks[page]

			for (var apage in exp.actions) {
				for (var key in exp.actions[apage]) {
					var action = exp.actions[apage][key]

					if (exp.instances[action.instance] === undefined) {
						if (self.instance[action.instance] !== undefined) {
							exp.instances[action.instance] = self.instance[action.instance]
						}
					}
				}
			}

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_page ' + page + '_' + getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}

		if ((match = req.url.match(/^\/full_export/))) {
			// Export file protocol version
			var exp = {
				version: file_version,
				type: 'full',
			}

			exp.config = cleanPages(_.cloneDeep(self.config))
			exp.instances = {}

			exp.actions = self.bank_actions
			exp.release_actions = self.bank_release_actions

			system.emit('get_page', function (page_config) {
				exp.page = page_config
			})

			system.emit('db_get', 'instance', function (res) {
				exp.instances = res
			})

			exp.feedbacks = self.feedbacks

			res.writeHeader(200, {
				'Content-Type': 'application/json',
				'Content-Disposition':
					'attachment; filename="' + os.hostname() + '_full-config' + '_' + getTimestamp() + '.companionconfig"',
			})
			res.end(JSON.stringify(exp))

			done()
		}
	})
}

exports = module.exports = loadsave

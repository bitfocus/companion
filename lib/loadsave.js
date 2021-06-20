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

	system.emit('action_get_bank_sets', function (bank_action_sets) {
		self.bank_action_sets = bank_action_sets
	})

	system.emit('feedback_getall', function (feedbacks) {
		self.feedbacks = feedbacks
	})

	system.on('export_bank', function (page, bank, cb) {
		var exp = {}

		exp.config = _.cloneDeep(self.config[page][bank])
		exp.instances = {}

		if (self.bank_action_sets[page] !== undefined) {
			exp.action_sets = _.cloneDeep(self.bank_action_sets[page][bank])
		}

		if (self.feedbacks[page] !== undefined) {
			exp.feedbacks = _.cloneDeep(self.feedbacks[page][bank])
		}

		debug('Exported config to bank ' + page + '.' + bank)
		cb(exp)
	})

	function variable_rename(str, fromname, toname) {
		var result

		if (str) {
			system.emit('variable_rename_callback', str, fromname, toname, function (res) {
				result = res
			})
		}

		return result
	}

	function convert15to32(obj) {
		var newobj = {}
		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			newobj[i + 1] = []
		}

		for (var bank in obj) {
			system.emit('bank_get12to32', parseInt(bank), function (_bank) {
				newobj[_bank] = obj[bank]
			})
		}

		return newobj
	}

	function convert_page_to_v2(obj) {
		console.log('convert_page_to_v2', obj)
		var data = {}

		data.orig_version = obj.version
		data.version = 2

		data.type = obj.type
		data.page = obj.page

		data.instances = obj.instances

		// Banks
		data.config = convert15to32(obj.config)
		data.config[1] = { style: 'pageup' }
		data.config[9] = { style: 'pagenum' }
		data.config[17] = { style: 'pagedown' }

		// Note we are upgrading to v2 here, so no need to worry about action_sets

		// Actions
		data.actions = convert15to32(obj.actions)

		// Release actions
		data.release_actions = convert15to32(obj.release_actions)

		// Feedbacks
		data.feedbacks = convert15to32(obj.feedbacks)

		console.log('convert_page_to_v2: done')
		return data
	}

	function convert_full_to_v2(obj) {
		console.log('convert_full_to_v2', obj)
		obj.version = 2

		console.log('FULL CONFIG; do conversion for each page')

		// Note we are upgrading to v2 here, so no need to worry about action_sets
		if (obj.actions === undefined) {
			obj.actions = {}
		}

		if (obj.release_actions === undefined) {
			obj.release_actions = {}
		}

		if (obj.feedbacks === undefined) {
			obj.feedbacks = {}
		}

		for (var page in obj.page) {
			var data = { type: 'page', version: 1 }

			data.page = obj.page[page]
			data.config = obj.config[page]
			data.actions = obj.actions[page]
			data.release_actions = obj.release_actions[page]
			data.feedbacks = obj.feedbacks[page]

			console.log('Recursive convert page ' + page, data)
			var newdata = convert_page_to_v2(data)
			console.log('Converted to v2 ', newdata)

			obj.page[page] = newdata.page
			obj.config[page] = newdata.config
			obj.actions[page] = newdata.actions
			obj.release_actions[page] = newdata.release_actions
			obj.feedbacks[page] = newdata.feedbacks
		}

		console.log('convert_full_to_v2: done')
		return obj
	}

	function convert_page_to_v3(obj) {
		console.log('convert_page_to_v3', obj)
		var data = {}

		data.orig_version = obj.orig_version || obj.version
		data.version = 3

		data.type = obj.type
		data.page = obj.page

		data.instances = obj.instances
		data.feedbacks = obj.feedbacks

		data.config = {}
		data.action_sets = {}

		// Banks
		for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
			data.config[bank] = obj.config[bank]
			system.emit('bank_upgrade_style', data.config[bank])

			self.system.emit(
				'action_combine_to_sets',
				data.config[bank],
				obj.actions[bank],
				obj.release_actions[bank],
				function (res) {
					data.action_sets[bank] = res
				}
			)
		}

		console.log('convert_page_to_v3: done')
		return data
	}

	function convert_full_to_v3(obj) {
		console.log('convert_full_to_v3', obj)
		obj.version = 3
		obj.action_sets = {}

		if (obj.actions === undefined) {
			obj.actions = {}
		}

		if (obj.release_actions === undefined) {
			obj.release_actions = {}
		}

		for (var page in obj.page) {
			var data = { type: 'page', version: 2 }

			data.config = obj.config[page]
			data.actions = obj.actions[page]
			data.release_actions = obj.release_actions[page]

			console.log('Recursive convert page ' + page, data)
			var newdata = convert_page_to_v3(data)
			console.log('Converted to v3 ', newdata)

			obj.config[page] = newdata.config
			obj.action_sets[page] = newdata.action_sets
		}

		delete obj.actions
		delete obj.release_actions

		console.log('convert_full_to_v3: done')
		return obj
	}

	// Convert config from older versions of companion
	// Commence backwards compatibility!
	function upgrade_import_version(obj) {
		// Version 1 = 15 keys, Version 2 = 32 keys, Version 3 = action_sets

		if (obj.type == 'full') {
			if (obj.version <= 1) obj = convert_full_to_v2(obj)
			if (obj.version <= 2) obj = convert_full_to_v3(obj)

			return obj
		} else {
			if (obj.version <= 1) obj = convert_page_to_v2(obj)
			if (obj.version <= 2) obj = convert_page_to_v3(obj)

			return obj
		}
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

				object = upgrade_import_version(object)

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

					// make magical page buttons!
					system.emit('bank_style', page, 1, 'pageup')
					system.emit('bank_style', page, 9, 'pagenum')
					system.emit('bank_style', page, 17, 'pagedown')
				}

				for (var key in self.instance) {
					if (key != 'bitfocus-companion' && self.instance[key].instance_type != 'bitfocus-companion') {
						system.emit('instance_delete', key, self.instance[key].label)
					}
				}

				// reset the scheduler/triggers
				system.emit('schedule_clear')

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

						if (data.action_sets && data.action_sets[page] && data.action_sets[page][bank]) {
							obj.action_sets = data.action_sets[page][bank]
						} else {
							let old_actions = []
							let old_release_actions = []

							if (data.actions && data.actions[page] && data.actions[page][bank]) {
								old_actions = data.actions[page][bank]
							}
							if (data.release_actions && data.release_actions[page] && data.release_actions[page][bank]) {
								old_release_actions = data.release_actions[page][bank]
							}

							obj.action_sets = {}
							self.system.emit('action_combine_to_sets', obj.config, old_actions, old_release_actions, function (res) {
								obj.action_sets = res
							})
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
					// action sets get combined below
					data.actions = data.actions === undefined ? {} : data.actions[frompage]
					data.release_actions = data.release_actions === undefined ? {} : data.release_actions[frompage]
					data.feedbacks = data.feedbacks === undefined ? {} : data.feedbacks[frompage]

					if (data.action_sets) data.action_sets = data.action_sets[frompage]
				}

				if (!data.action_sets) {
					data.action_sets = {}

					const page_config = data.config || {}
					const page_actions = data.actions || {}
					const page_release_actions = data.release_actions || {}

					for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
						self.system.emit(
							'action_combine_to_sets',
							page_config[bank],
							page_actions[bank],
							page_release_actions[bank],
							function (res) {
								data.action_sets[bank] = res
							}
						)
					}
				}

				// These are no longer needed
				delete data.actions
				delete data.release_actions

				if (data.page !== undefined) {
					system.emit('page_set', topage, data.page)
				} else {
					system.emit('page_set', topage, { name: 'PAGE' })
				}

				for (var i = 1; i <= global.MAX_BUTTONS; ++i) {
					system.emit('bank_reset', topage, i)
				}

				if (!data.instances['bitfocus-companion']) {
					const idx = data.orig_version > 1 ? 2 : -1 // This is a hack. After this version it is tracked correctly.
					// We put it to 2 as its the 'safest' value to not break recent exports, at the cost of older ones (rather than the other way around)
					// But if data.orig_version is 1, then we know the snapshot needs to run all the scripts

					data.instances['bitfocus-companion'] = {
						import_to: 'bitfocus-companion',
						label: 'internal',
						id: 'bitfocus-companion',
						instance_type: 'bitfocus-companion',
						_configIdx: idx,
					}
				} else {
					data.instances['bitfocus-companion'].import_to = 'bitfocus-companion'
				}

				for (var key in data.instances) {
					var type = data.instances[key].instance_type
					var instance_created = false
					var instance_id = key == 'bitfocus-companion' ? 'bitfocus-companion' : data.instances[key].import_to
					if (key != 'bitfocus-companion' && instance_id == 'new') {
						var product = data.instances[key].product
						system.emit(
							'instance_add',
							{ type, product },
							function (id, config) {
								instance_id = id
								instance_created = true

								for (var i in data.instances[key]) {
									if (i != 'label') {
										config[i] = data.instances[key][i]
									}
								}

								system.emit('instance_config_put', id, config)
							},
							true
						)
					}

					for (var bank in data.config) {
						if (self.instance[instance_id]) {
							data.config[bank].text = variable_rename(
								data.config[bank].text,
								data.instances[key].label,
								self.instance[instance_id].label
							)
						}
					}

					let instance_actions = []

					for (let bank in data.action_sets) {
						for (let set in data.action_sets[bank]) {
							for (var i = 0; i < data.action_sets[bank][set].length; ++i) {
								var act = data.action_sets[bank][set][i]

								if (act.instance == key) {
									act.instance = instance_id
									act.label = act.instance + ':' + act.action
									instance_actions.push(act)
								}
							}
						}
					}

					let instance_feedbacks = []
					for (var bank in data.feedbacks) {
						for (var i = 0; i < data.feedbacks[bank].length; ++i) {
							var act = data.feedbacks[bank][i]

							if (act.instance_id == key) {
								act.instance_id = instance_id
								instance_feedbacks.push(act)
							}
						}
					}

					// run upgrade-scripts for all the imported things
					system.emit(
						'instance_upgrade_imported',
						instance_id,
						instance_created,
						type,
						data.instances[key],
						instance_actions,
						instance_feedbacks
					)

					if (instance_created) {
						// now the module can be enabled
						system.emit('instance_enable', instance_id, true)
					}
				}

				for (var bank in data.config) {
					var obj = {}
					obj.config = data.config !== undefined ? data.config[bank] : {}
					obj.action_sets = data.action_sets !== undefined ? data.action_sets[bank] : {}
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

		system.emit('bank_upgrade_style', imp.config)

		// TODO: Rename variable definitions
		self.config[page][bank] = imp.config

		if (!imp.action_sets) {
			if (self.bank_action_sets[page] === undefined) {
				self.bank_action_sets[page] = {}
			}
			if (self.bank_action_sets[page][bank] === undefined) {
				self.bank_action_sets[page][bank] = {}
			}

			self.system.emit('action_combine_to_sets', imp.config, imp.actions, imp.release_actions, function (res) {
				for (let set in res) {
					const actions_set = res[set]
					for (const action of actions_set) {
						action.id = shortid.generate()
					}
				}

				self.bank_action_sets[page][bank] = res
			})
		} else {
			for (let set in imp.action_sets) {
				const actions_set = imp.action_sets[set]
				for (const action of actions_set) {
					action.id = shortid.generate()
				}
			}

			self.bank_action_sets[page][bank] = imp.action_sets
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

			var instance_ids = new Set()

			for (var action_set of Object.values(exp.action_sets)) {
				for (const action of action_set) {
					instance_ids.add(action.instance)
				}
			}
			for (var feedback of exp.feedbacks) {
				instance_ids.add(feedback.instance_id)
			}

			for (var instance_id of instance_ids) {
				if (instance_id && self.instance[instance_id]) {
					exp.instances[instance_id] = self.instance[instance_id]
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

			exp.action_sets = self.bank_action_sets[page]
			exp.feedbacks = self.feedbacks[page]

			system.emit('get_page', function (page_config) {
				exp.page = page_config[page]
			})

			var instance_ids = new Set()

			for (var bank of Object.values(exp.action_sets)) {
				if (bank) {
					for (var action_set of Object.values(bank)) {
						for (const action of action_set) {
							instance_ids.add(action.instance)
						}
					}
				}
			}
			for (var bank of Object.values(exp.feedbacks)) {
				if (bank) {
					for (var feedback of bank) {
						instance_ids.add(feedback.instance_id)
					}
				}
			}

			for (var instance_id of instance_ids) {
				if (instance_id && self.instance[instance_id]) {
					exp.instances[instance_id] = self.instance[instance_id]
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

			exp.action_sets = self.bank_action_sets

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

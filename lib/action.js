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

var system
var debug = require('debug')('lib/action')
var shortid = require('shortid')

function action(system) {
	var self = this

	self.system = system
	self.actions = {}
	self.bank_action_sets = {} // [page][bank][set]. when style is step, set is a number. when style is press, set is 'down' or 'up
	self.bank_actions = {}
	self.bank_release_actions = {}
	self.bank_status = {}
	self.instance = {}
	self.actions_running = new Set()
	self.timers_running = new Map()

	self.system.on('action_combine_to_sets', function (style, actions, release_actions, cb) {
		const bank_action_sets = {}
		if (style.style == 'press') {
			bank_action_sets['down'] = actions || []
			bank_action_sets['up'] = release_actions || []
		} else if (style.style == 'step') {
			bank_action_sets[0] = actions || []
			bank_action_sets[1] = release_actions || []
		}
		cb(bank_action_sets)
	})

	self.system.on('actions_upgrade_step_structure', function () {
		// once the bank is ready, we can try to do our upgrades
		let old_actions = {}
		self.system.emit('db_get', 'bank_actions', function (res) {
			if (res !== undefined) {
				old_actions = res
			}
		})
		let old_release_actions = {}
		self.system.emit('db_get', 'bank_release_actions', function (res) {
			if (res !== undefined) {
				old_release_actions = res
			}
		})

		for (var page in self.config) {
			if (self.bank_action_sets[page] === undefined) {
				self.bank_action_sets[page] = {}
			}
			const page_actions = old_actions[page] || {}
			const page_release_actions = old_release_actions[page] || {}

			for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				if (self.bank_action_sets[page][bank] === undefined) {
					self.bank_action_sets[page][bank] = {}

					self.system.emit('bank_style', page, bank, function (style) {
						self.system.emit(
							'action_combine_to_sets',
							style,
							page_actions[bank],
							page_release_actions[bank],
							function (res) {
								self.bank_action_sets[page][bank] = res
							}
						)
					})
				}
			}
		}
	})

	function cleanup_actions_list(actions_sets) {
		const res = {}

		for (var page in actions_sets) {
			res[page] = {}
			for (var bank in actions_sets[page]) {
				res[page][bank] = {}

				if (actions_sets[page][bank] !== undefined) {
					for (var set in actions_sets[page][bank]) {
						if (actions_sets[page][bank][set] !== undefined) {
							res[page][bank][set] = []
							for (var i = 0; i < actions[page][bank][set].length; ++i) {
								const action = actions[page][bank][set][i]
								if (action && self.instance.store.db[action.instance]) {
									res[page][bank][set].push(action)
								}
							}
						}
					}
				}
			}
		}

		return res
	}

	self.system.on('instance', function (obj) {
		debug('got instance')
		self.instance = obj

		// ensure all actions are valid
		self.bank_action_sets = cleanup_actions_list(self.bank_action_sets)

		self.system.emit('db_set', 'bank_action_sets', self.bank_action_sets)
		self.system.emit('db_save')
	})

	self.system.on('action_save', function () {
		self.system.emit('db_set', 'bank_action_sets', self.bank_action_sets)
		self.system.emit('db_save')
		debug('saving')
	})

	self.system.on('instance_save', function () {
		setImmediate(function () {
			self.io.emit('actions', self.actions)
		})
	})

	self.system.on('instance_delete', function (id) {
		self.iterateActionSets(function (actions, page, bank, set) {
			let changed = false

			for (var i = 0; i < actions.length; ++i) {
				var action = actions[i]

				if (action.instance == id) {
					debug(`Deleting action ${i} from button ${page}.${bank}:${set}`)
					self.unsubscribeAction(action)
					actions.splice(i, 1)
					i--

					changed = true
				}
			}

			if (changed) {
				self.system.emit('instance_status_check_bank', page, bank)
			}
		})
	})

	self.system.on('action_get_bank_sets', function (cb) {
		cb(self.bank_action_sets)
	})

	self.system.on('actions_for_instance', function (instance_id, cb) {
		var actions = []

		self.iterateActions(function (action) {
			if (action.instance == instance_id) {
				actions.push(action)
			}
		})

		cb(actions)
	})

	function checkBank(page, bank) {
		var status = 0

		const instance_ids = new Set()
		const action_sets = (self.bank_action_sets[page] || {})[bank] || {}

		for (let set in action_sets) {
			if (action_sets[set]) {
				for (const action of action_sets[set]) {
					instance_ids.add(action.instance)
				}
			}
		}

		for (const instance_id of instance_ids) {
			system.emit('instance_status_get', instance_id, function (instance_status) {
				if (instance_status !== undefined && status < instance_status[0]) {
					status = instance_status[0]
				}
			})
		}

		if (status != self.bank_status[page + '_' + bank]) {
			self.bank_status[page + '_' + bank] = status
			self.system.emit('action_bank_status_set', page, bank, status)
		}
	}

	self.system.on('action_bank_status_get', function (page, bank, cb) {
		cb(self.bank_status[page + '_' + bank])
	})

	self.system.on('instance_status_check_bank', function (page, bank) {
		checkBank(page, bank)
	})

	self.system.on('instance_status_set', function (instance, level, msg) {
		for (var page in self.bank_action_sets) {
			if (self.bank_action_sets[page] !== undefined) {
				for (var bank in self.bank_action_sets[page]) {
					if (self.bank_action_sets[page][bank] !== undefined) {
						checkBank(page, bank)
					}
				}
			}
		}
	})

	self.system.on('action_running_get', function (page, bank, cb) {
		cb(self.actions_running.has(`${page}_${bank}`))
	})

	// If a user wants to panic-abort all timers running
	self.system.on('action_delayed_abort', function () {
		debug('Aborting delayed actions')

		for (let timer of self.timers_running.keys()) {
			debug('clearing timer')
			clearTimeout(timer)
		}
		self.timers_running.clear()

		var actions_running = self.actions_running //clone hack
		self.actions_running = new Set() // clear the array

		for (let bid of actions_running.keys()) {
			const a = bid.split('_')
			self.system.emit('graphics_bank_invalidate', a[0], a[1])
		}
	})

	// skipUp needed to abort 'up' actions on non-latch buttons
	var skipUp = {}

	// If a user wants to abort a single button actions
	self.system.on('action_abort_bank', function (page, bank, unlatch) {
		var bid = page + '_' + bank
		var cleared = 0

		self.actions_running.delete(bid)

		self.timers_running.forEach((timerId, timer) => {
			if (timerId === bid) {
				if (cleared == 0) {
					debug('Aborting button ', page, ',', bank)
				}
				clearTimeout(timer)
				self.timers_running.delete(timer)
				cleared += 1
			}
		})

		// if requested, reset and skip up-actions
		if (unlatch) {
			self.system.emit('graphics_indicate_push', page, bank, false)
			skipUp[page + '_' + bank] = true
		}

		if (cleared > 0) {
			self.system.emit('graphics_bank_invalidate', page, bank)
		}
	})

	// skipNext needed for 'bank_pressed' callback
	var skipNext = {}
	var pageStyles = ['pageup', 'pagenum', 'pagedown']

	self.system.on('bank_pressed', function (page, bank, direction, deviceid) {
		var bank_config
		var pb = page + '_' + bank

		system.emit('get_bank', page, bank, function (config) {
			bank_config = config
		})

		if (bank_config.latch) {
			if (deviceid == undefined) {
				// web buttons and osc don't set deviceid
				deviceid = 'osc-web'
			}

			if (skipNext[pb] != undefined) {
				// ignore release after latching press
				// from this device
				if (skipNext[pb] == deviceid) {
					delete skipNext[pb] // reduce memory creep
					return
				}
			}

			let reject = false
			system.emit('graphics_is_pushed', page, bank, function (pushed) {
				let isPushed = 1 == pushed ? true : false
				// button is being pressed but not yet latched
				// the next button-release from this device needs to be skipped
				// because the 'release' would immediately un-latch the button
				if (direction && !isPushed) {
					skipNext[pb] = deviceid
				} else if (direction && pushed) {
					// button is latched, prevent duplicate down actions
					// the following 'release' will run the up actions
					reject = true
				} else if (!(direction || pushed)) {
					// button is up, prevent duplicate up actions
					reject = true
				}
			})

			if (reject) {
				//debug("Latch button duplicate " + (direction? "down":"up") )
				return
			}
		}

		if (skipUp[pb]) {
			delete skipUp[pb]
			if (!bank_config.latch) {
				return
			}
		}

		// magic page keys only respond to push so ignore the release
		// they also don't have a 'pushed' graphics indication
		// so process the action and return before trying to
		// indicate 'pushed'. Otherwise when the 'unpush' graphics
		// occurs, it will re-draw the old button on the new (wrong) page
		if (pageStyles.includes(bank_config.style)) {
			if (direction === true) {
				if (bank_config.style == 'pageup') {
					self.system.emit('device_page_up', deviceid)
				} else if (bank_config.style == 'pagenum') {
					self.system.emit('device_page_set', deviceid, 1)
				} else if (bank_config.style == 'pagedown') {
					self.system.emit('device_page_down', deviceid)
				}
			}
			// no actions allowed on page buttons so we're done
			return
		}

		system.emit('graphics_indicate_push', page, bank, direction, deviceid)

		var obj = self.bank_actions

		// find release actions if the direction is up
		if (direction === false) {
			obj = self.bank_release_actions
		}

		if (obj[page] === undefined || obj[page][bank] === undefined || obj[page][bank].length === 0) {
			return
		}

		debug('found actions')

		// Handle whether the delays are absolute or relative.
		var action_delay = 0
		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n]
			var this_delay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay)

			if (bank_config.relative_delay) {
				// Relative delay: each action's delay adds to the next.
				action_delay += this_delay
			} else {
				// Absolute delay: each delay is its own.
				action_delay = this_delay
			}

			// Create the property .effective_delay. Don't change the user's .delay property.
			a.effective_delay = action_delay
		}

		const bankId = `${page}_${bank}`

		let has_delayed = false
		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n]
			var delay = a.effective_delay === undefined ? 0 : parseInt(a.effective_delay)
			delete a.effective_delay

			debug('Running action', a)

			if (self.instance !== undefined && self.instance.store !== undefined && self.instance.store.db !== undefined) {
				if (self.instance.store.db[a.instance] !== undefined && self.instance.store.db[a.instance].enabled !== false) {
					// is this a timedelayed action?
					if (delay > 0) {
						has_delayed = true
						;(function (action, delay_time) {
							var timer = setTimeout(function () {
								self.system.emit('action_run', action, { deviceid: deviceid, page: page, bank: bank })

								self.timers_running.delete(timer)

								// Stop timer-indication
								const hasAnotherTimer = Array.from(self.timers_running.values()).find((v) => v === bankId)
								if (hasAnotherTimer === undefined) {
									self.actions_running.delete(bankId)
									self.system.emit('graphics_bank_invalidate', page, bank)
								}
							}, delay_time)

							self.timers_running.set(timer, bankId)
						})(a, delay)
					}

					// or is it immediate
					else {
						self.system.emit('action_run', a, { deviceid: deviceid, page: page, bank: bank })
					}
				} else {
					debug('not running action for disabled instance')
				}
			} else {
				debug("wow, instance store didn't exist")
			}
		}

		if (has_delayed) {
			// Start timer-indication
			self.actions_running.add(bankId)

			self.system.emit('graphics_bank_invalidate', page, bank)
		}
	})

	self.system.on('action_run', function (action, extras) {
		if (self.instance !== undefined && self.instance.store !== undefined && self.instance.store.db !== undefined) {
			self.system.emit('instance_get', action.instance, function (instance) {
				if (
					self.instance.store.db[action.instance] !== undefined &&
					self.instance.store.db[action.instance].enabled !== false
				) {
					const definition = self.actions[`${action.instance}:${action.action}`]

					try {
						// Ask instance to execute action
						if (
							definition !== undefined &&
							definition.callback !== undefined &&
							typeof definition.callback == 'function'
						) {
							definition.callback(action, extras)
						} else if (instance !== undefined && typeof instance.action == 'function') {
							/*
							  https://github.com/bitfocus/companion/issues/1117
							  https://sentry.bitfocus.io/organizations/bitfocus/issues/11/?project=8

							  the line above was "fixed" by the 'instance !== undefined' to
							  avoid surprise features/bugs..
							  I don't have a clue what's going on here.. Help wanted. -WV
							  Sentry tells us that 33 users got this 236 times over 11 days
							*/
							instance.action(action, extras)
						} else {
							debug('ERROR: instance does not have an action() function:', instance)
						}
					} catch (e) {
						self.system.emit('log', 'instance(' + instance.label + ')', 'warn', 'Error executing action: ' + e.message)
					}
				} else {
					debug('trying to run action on a deleted instance.', action)
				}
			})
		}
	})

	self.system.emit('io_get', function (io) {
		self.io = io
		self.system.on('io_connect', function (client) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					client.emit(name, ...args)
				}
			}

			client.on('get_actions', function () {
				client.emit('actions', self.actions)
			})

			client.on('bank_update_action_delay', function (page, bank, set, action, value) {
				const action_set = (self.bank_action_sets[page][bank] || {})[set]
				if (action_set) {
					for (let obj in action_set) {
						if (obj && obj.id === action) {
							obj.delay = value
							self.system.emit('action_save')
						}
					}
				}
			})

			client.on('bank_update_action_option', function (page, bank, set, action, option, value) {
				debug('bank_update_action_option', page, bank, action, option, value)
				const action_set = (self.bank_action_sets[page][bank] || {})[set]
				if (action_set) {
					for (let obj in action_set) {
						if (obj && obj.id === action) {
							self.unsubscribeAction(obj)
							if (obj.options === undefined) {
								obj.options = {}
							}
							obj.options[option] = value
							self.subscribeAction(obj)
							self.system.emit('action_save')
						}
					}
				}
			})

			client.on('bank_action_add', function (page, bank, set, action, answer) {
				if (self.bank_action_sets[page] === undefined) self.bank_action_sets[page] = {}
				if (self.bank_action_sets[page][bank] === undefined) self.bank_action_sets[page][bank] = {}
				if (self.bank_action_sets[page][bank][set] === undefined) {
					// cant implicitly create a set
					return
				}

				var s = action.split(/:/)
				var act = {
					id: shortid.generate(),
					label: action,
					instance: s[0],
					action: s[1],
					options: {},
				}

				if (!self.instance.store.db[act.instance]) {
					// Action is not valid
					return
				}

				if (self.actions[action] !== undefined) {
					var definition = self.actions[action]

					if (definition.options !== undefined && definition.options.length > 0) {
						for (var j in definition.options) {
							var opt = definition.options[j]
							act.options[opt.id] = opt.default
						}
					}
				}

				self.bank_action_sets[page][bank][set].push(act)
				self.subscribeAction(act)

				system.emit('action_save')
				sendResult(answer, 'bank_actions_get:result', page, bank, self.bank_action_sets[page][bank])
				system.emit('instance_status_check_bank', page, bank)
			})

			client.on('bank_action_delete', function (page, bank, set, id, answer) {
				const action_set = (self.bank_action_sets[page][bank] || {})[set]
				if (action_set) {
					for (let i = 0; i < action_set.length; i++) {
						if (action_set[n].id == id) {
							self.unsubscribeAction(action_set[n])
							action_set.splice(n, 1)
							break
						}
					}
				}

				system.emit('action_save')
				sendResult(answer, 'bank_actions_get:result', page, bank, self.bank_action_sets[page][bank])
				system.emit('instance_status_check_bank', page, bank)
			})

			client.on('bank_actions_get', function (page, bank, answer) {
				if (self.bank_action_sets[page] === undefined) self.bank_action_sets[page] = {}
				if (self.bank_action_sets[page][bank] === undefined) self.bank_action_sets[page][bank] = {}
				sendResult(answer, 'bank_actions_get:result', page, bank, self.bank_action_sets[page][bank])
			})

			client.on('bank_update_action_option_order', function (page, bank, set, old_index, new_index) {
				const action_set = (self.bank_action_sets[page][bank] || {})[set]
				if (action_set) {
					action_set.splice(new_index, 0, action_set.splice(old_index, 1)[0])
					self.system.emit('action_save')
				}
			})
		})
	})

	self.system.on('instance_delete', function (id) {
		for (var n in self.actions) {
			var x = n.split(/:/)
			if (x[0] == id) {
				delete self.actions[n]
			}
		}
		self.system.emit('actions_update')
	})

	system.on('action_subscribe_bank', function (page, bank) {
		if (self.bank_action_sets[page] !== undefined && self.bank_action_sets[page][bank] !== undefined) {
			for (var set in self.bank_action_sets[page][bank]) {
				const action_set = self.bank_action_sets[page][bank][set]
				if (action_set) {
					for (let i = 0; i < action_set.length; i++) {
						self.subscribeAction(action_set[i])
					}
				}
			}
		}
	})

	system.on('action_unsubscribe_bank', function (page, bank) {
		if (self.bank_action_sets[page] !== undefined && self.bank_action_sets[page][bank] !== undefined) {
			for (var set in self.bank_action_sets[page][bank]) {
				const action_set = self.bank_action_sets[page][bank][set]
				if (action_set) {
					for (let i = 0; i < action_set.length; i++) {
						self.unsubscribeAction(action_set[i])
					}
				}
			}
		}
	})

	self.system.on('bank_reset', function (page, bank) {
		system.emit('action_unsubscribe_bank', page, bank)

		if (self.bank_action_sets[page] === undefined) {
			self.bank_action_sets[page] = {}
		}
		self.bank_action_sets[page][bank] = {}

		debug('bank_reset()', page, bank)

		self.system.emit('action_save')
	})

	self.system.on('actions_update', function () {
		debug('actions_update:', self.actions)
		self.io.emit('actions', self.actions)
	})

	self.system.on('instance_actions', function (id, actions) {
		let newActions = {}
		// actions[instance_id:action]
		for (var m in self.actions) {
			var idActionSplit = m.split(':')
			// only add other id actions.
			if (idActionSplit[0] != id) {
				newActions[m] = self.actions[m]
			}
		}
		// overwrite old action array with cleared one
		self.actions = newActions

		for (var n in actions) {
			var a = actions[n]
			self.actions[id + ':' + n] = a
			debug('adding action', id + ':' + n)
		}
		self.io.emit('actions', self.actions)
	})

	return self
}

action.prototype.subscribeAction = function (action) {
	var self = this

	if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
		const actionId = `${action.instance}:${action.action}`
		if (self.actions[actionId] !== undefined) {
			let definition = self.actions[actionId]
			// Run the subscribe function if needed
			if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
				definition.subscribe(action)
			}
		}
	}
}

action.prototype.unsubscribeAction = function (action) {
	var self = this

	if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
		const actionId = `${action.instance}:${action.action}`
		if (self.actions[actionId] !== undefined) {
			let definition = self.actions[actionId]
			// Run the unsubscribe function if needed
			if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
				definition.unsubscribe(action)
			}
		}
	}
}

action.prototype.iterateActions = function (cb) {
	var self = this

	self.iterateActionSets(function (arr, page, bank, set) {
		for (var i = 0; i < arr.length; ++i) {
			cb(arr[i], page, bank, set, i)
		}
	})
}

action.prototype.iterateActionSets = function (cb) {
	var self = this

	for (var page in self.bank_action_sets) {
		for (var bank in self.bank_action_sets[page]) {
			if (self.bank_action_sets[page][bank] !== undefined) {
				for (var set in self.bank_action_sets[page][bank]) {
					if (self.bank_action_sets[page][bank][set] !== undefined) {
						cb(self.bank_action_sets[page][bank][set], page, bank, set)
					}
				}
			}
		}
	}
}

exports = module.exports = function (system) {
	return new action(system)
}

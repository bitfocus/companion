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

const shortid = require('shortid')
const CoreBase = require('../Core/Base')
const Registry = require('../Registry')

class BankAction extends CoreBase {
	constructor(registry) {
		super(registry, 'action', 'lib/Bank/Action')

		this.action_definitions = {}
		this.bank_action_sets = this.db.getKey('bank_action_sets', {}) // [page][bank][set]. when style is step, set is a number. when style is press, set is 'down' or 'up'
		this.bank_cycle_step = {}
		this.bank_status = {}
		this.actions_running = new Set()
		this.timers_running = new Map()

		// Create structure for the current position through the steps
		for (var page = 1; page <= 99; page++) {
			this.bank_cycle_step[page] = {}
			for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				this.bank_cycle_step[page][bank] = '0'
			}
		}

		this.system.on('action_setup_bank', (page, bank, style) => {
			this.bank_cycle_step[page][bank] = '0'

			this.bank_set_step_change(page, bank, this.bank_cycle_step[page][bank])

			if (style === 'press') {
				this.bank_action_sets[page][bank] = {
					down: [],
					up: [],
				}
			} else if (style === 'step') {
				this.bank_action_sets[page][bank] = {
					0: [],
				}
			} else {
				this.bank_action_sets[page][bank] = {}
			}

			this.io.emit('bank_action_sets_list', page, bank, Object.keys(this.bank_action_sets[page][bank]))
		})

		this.system.on('bank_action_sets_step_getall', (cb) => {
			const result = {}

			for (var page = 1; page <= 99; page++) {
				result[page] = {}
				for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					const index = Object.keys(this.bank_action_sets[page][bank]).indexOf(this.bank_cycle_step[page][bank])
					result[page][bank] = index === -1 ? 0 : index
				}
			}

			cb(result)
		})
		this.system.on('bank_action_sets_step_set', (page, bank, step) => {
			if (
				this.bank_action_sets[page] &&
				this.bank_cycle_step[page] &&
				this.bank_action_sets[page][bank] &&
				this.bank_cycle_step[page][bank] &&
				typeof step === 'number'
			) {
				const set = Object.keys(this.bank_action_sets[page][bank])[step - 1]
				if (set !== undefined) {
					this.bank_set_next_step(page, bank, set)
				}
			}
		})
		this.system.on('bank_action_sets_step_delta', (page, bank, amount) => {
			if (
				this.bank_action_sets[page] &&
				this.bank_cycle_step[page] &&
				this.bank_action_sets[page][bank] &&
				this.bank_cycle_step[page][bank] &&
				amount &&
				typeof amount === 'number'
			) {
				const all_steps = Object.keys(this.bank_action_sets[page][bank])
				if (all_steps.length > 0) {
					const current = all_steps.indexOf(this.bank_cycle_step[page][bank])

					let newIndex = (current === -1 ? 0 : current) + amount
					while (newIndex < 0) newIndex += all_steps.length
					newIndex = newIndex % all_steps.length

					this.bank_set_next_step(page, bank, all_steps[newIndex])
				}
			}
		})

		this.system.on('instance', (obj) => {
			this.debug('got instance')
			const instance = obj

			// ensure all actions are valid
			this.iterateActionSets((actions, page, bank, set) => {
				this.bank_action_sets[page][bank][set] = actions.filter(
					// ensure actions are objects and have a valid instance
					(action) => action && instance.store.db[action.instance]
				)
			})

			this.db.setKey('bank_action_sets', this.bank_action_sets)
		})

		this.system.on('action_save', () => {
			this.db.setKey('bank_action_sets', this.bank_action_sets)
			this.debug('saving')
		})

		this.system.on('instance_delete', (id) => {
			this.iterateActionSets((actions, page, bank, set) => {
				let changed = false

				for (var i = 0; i < actions.length; ++i) {
					var action = actions[i]

					if (action.instance == id) {
						this.debug(`Deleting action ${i} from button ${page}.${bank}:${set}`)
						actions.splice(i, 1)
						i--

						changed = true
					}
				}

				if (changed) {
					this.system.emit('instance_status_check_bank', page, bank)
				}
			})

			// Remove the definitions
			delete this.action_definitions[id]
			this.io.emit('action_instance_definitions_ft', id, undefined)
		})

		this.system.on('action_get_bank_sets', (cb) => {
			cb(this.bank_action_sets)
		})

		this.system.on('action_get_bank_active_step', (page, bank, cb) => {
			let out = 0

			if (this.bank_cycle_step[page] !== undefined && this.bank_cycle_step[page][bank] !== undefined) {
				out = this.bank_cycle_step[page][bank]
			}

			if (typeof cb === 'function') {
				cb(out)
			}
		})

		this.system.on('actions_for_instance', (instance_id, cb) => {
			var actions = []

			this.iterateActions((action) => {
				if (action.instance == instance_id) {
					actions.push(action)
				}
			})

			this.system.emit('schedule_get_all_actions', (_actions) => {
				for (const action of _actions) {
					if (action.instance == instance_id) {
						actions.push(action)
					}
				}
			})

			cb(actions)
		})

		this.system.on('action_bank_status_get', (page, bank, cb) => {
			cb(this.bank_status[page + '_' + bank])
		})

		this.system.on('instance_status_check_bank', (page, bank) => {
			this.checkBankStatus(page, bank)
		})

		this.system.on('instance_status_set', (instance, level, msg) => {
			for (var page in this.bank_action_sets) {
				if (this.bank_action_sets[page] !== undefined) {
					for (var bank in this.bank_action_sets[page]) {
						if (this.bank_action_sets[page][bank] !== undefined) {
							this.checkBankStatus(page, bank)
						}
					}
				}
			}
		})

		this.system.on('action_running_get', (page, bank, cb) => {
			cb(this.actions_running.has(`${page}_${bank}`))
		})

		// If a user wants to panic-abort all timers running
		this.system.on('action_delayed_abort', () => {
			this.debug('Aborting delayed actions')

			for (let timer of this.timers_running.keys()) {
				this.debug('clearing timer')
				clearTimeout(timer)
			}
			this.timers_running.clear()

			var actions_running = this.actions_running //clone hack
			this.actions_running = new Set() // clear the array

			for (let bid of actions_running.keys()) {
				const a = bid.split('_')
				this.system.emit('graphics_bank_invalidate', a[0], a[1])
			}
		})

		// If a user wants to abort a single button actions
		this.system.on('action_abort_bank', (page, bank, skip_up) => {
			var bid = page + '_' + bank
			var cleared = 0

			this.actions_running.delete(bid)

			this.timers_running.forEach((timerId, timer) => {
				if (timerId === bid) {
					if (cleared == 0) {
						this.debug('Aborting button ', page, ',', bank)
					}
					clearTimeout(timer)
					this.timers_running.delete(timer)
					cleared += 1
				}
			})

			// if requested, reset and skip up-actions
			if (skip_up) {
				this.system.emit('bank_force_state', page, bank, false)
			}
		})

		this.system.on('bank_force_state', (page, bank, direction) => {
			this.system.emit('graphics_indicate_push', page, bank, direction)
			this.system.emit('graphics_bank_invalidate', page, bank)
		})

		this.system.on('bank_pressed', (page, bank, direction, deviceid) => {
			var bank_config = this.bank.getBank(page, bank)
			var pb = page + '_' + bank

			let action_set_id = null

			if (bank_config.style === 'step' && direction) {
				// ignore the up, as we don't perform any actions
				const this_step = this.bank_cycle_step[page][bank]
				const steps = Object.keys(this.bank_action_sets[page][bank])
				if (steps.length > 0) {
					steps.sort()

					// verify 'this_step' is valid
					const this_step_index = steps.findIndex((s) => s == this_step) || 0
					action_set_id = steps[this_step_index]

					if (bank_config.step_auto_progress) {
						// update what the next step will be
						const next_index = this_step_index + 1 >= steps.length ? 0 : this_step_index + 1
						this.bank_cycle_step[page][bank] = steps[next_index]

						this.bank_set_step_change(page, bank, this.bank_cycle_step[page][bank])
					}
				}
			} else if (bank_config.style === 'press') {
				let is_pushed = false
				this.system.emit('graphics_is_pushed', page, bank, (pushed) => {
					is_pushed = pushed
				})

				// if the direction has changed, then
				if (is_pushed && !direction) {
					action_set_id = 'up'
				} else if (!is_pushed && direction) {
					action_set_id = 'down'
				}
			}

			// magic page keys only respond to push so ignore the release
			// they also don't have a 'pushed' graphics indication
			if (bank_config.style == 'pageup') {
				if (direction) {
					this.system.emit('device_page_up', deviceid)
				}
				return
			} else if (bank_config.style == 'pagenum') {
				if (direction) {
					this.system.emit('device_page_set', deviceid, 1)
				}
				return
			} else if (bank_config.style == 'pagedown') {
				if (direction) {
					this.system.emit('device_page_down', deviceid)
				}
				return
			}

			// track the new push state, and redraw
			this.system.emit('graphics_indicate_push', page, bank, direction, deviceid)

			if (
				!action_set_id ||
				!this.bank_action_sets[page] ||
				!this.bank_action_sets[page][bank] ||
				!this.bank_action_sets[page][bank][action_set_id]
			) {
				return
			}
			const actions = this.bank_action_sets[page][bank][action_set_id]

			this.debug('found actions')

			const bankId = `${page}_${bank}`
			this.system.emit('action_run_multiple', actions, bankId, bank_config.relative_delay, {
				deviceid: deviceid,
				page: page,
				bank: bank,
			})
		})

		this.system.on('action_run_multiple', (actions, groupId, relative_delay, run_source) => {
			// Handle whether the delays are absolute or relative.
			const effective_delays = {}
			var action_delay = 0
			for (var n in actions) {
				var a = actions[n]
				var this_delay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay)

				if (relative_delay) {
					// Relative delay: each action's delay adds to the next.
					action_delay += this_delay
				} else {
					// Absolute delay: each delay is its own.
					action_delay = this_delay
				}

				// Create the property .effective_delay. Don't change the user's .delay property.
				effective_delays[a.id] = action_delay
			}

			let has_delayed = false
			for (var n in actions) {
				var a = actions[n]
				var delay = effective_delays[a.id] === undefined ? 0 : effective_delays[a.id]

				this.debug('Running action', a)

				// is this a timedelayed action?
				if (delay > 0) {
					has_delayed = true
					;((action, delay_time) => {
						var timer = setTimeout(() => {
							this.system.emit('action_run', action, run_source)

							this.timers_running.delete(timer)

							// Stop timer-indication
							const hasAnotherTimer = Array.from(this.timers_running.values()).find((v) => v === groupId)
							if (hasAnotherTimer === undefined) {
								this.actions_running.delete(groupId)
								if (run_source) {
									this.system.emit('graphics_bank_invalidate', run_source.page, run_source.bank)
								}
							}
						}, delay_time)

						this.timers_running.set(timer, groupId)
					})(a, delay)
				}

				// or is it immediate
				else {
					this.system.emit('action_run', a, run_source)
				}
			}

			if (has_delayed) {
				// Start timer-indication
				this.actions_running.add(groupId)

				if (run_source) {
					this.system.emit('graphics_bank_invalidate', run_source.page, run_source.bank)
				}
			}
		})

		this.system.on('action_run', (action, extras) => {
			const instance = this.instance.moduleHost.getChild(action.instance)
			if (instance) {
				instance.actionRun(action, extras).catch((e) => {
					this.debug(`Error executing action for ${instance.connectionId}: ${e.message}`)
					this.system.emit(
						'log',
						'instance(' + instance.connectionId + ')',
						'warn',
						'Error executing action: ' + e.message
					)
				})
			} else {
				this.debug('trying to run action on a missing instance.', action)
			}
		})

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {
				client.on('action_instance_definitions_get', (answer) => {
					answer(this.action_definitions)
				})

				client.on('bank_update_action_delay', (page, bank, set, action, value) => {
					const action_set = (this.bank_action_sets[page][bank] || {})[set]
					if (action_set) {
						for (let obj of action_set) {
							if (obj && obj.id === action) {
								obj.delay = value
								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('bank_update_action_option', (page, bank, set, action, option, value) => {
					this.debug('bank_update_action_option', page, bank, set, action, option, value)
					const action_set = (this.bank_action_sets[page][bank] || {})[set]
					if (action_set) {
						for (let obj of action_set) {
							if (obj && obj.id === action) {
								if (obj.options === undefined) {
									obj.options = {}
								}
								obj.options[option] = value

								const instance = this.instance.moduleHost.getChild(obj.instance)
								if (instance) {
									instance.actionUpdate(obj, page, bank).catch((e) => {
										this.debug(`action_update to connection failed: ${e.message}`)
									})
								}

								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('action_get_defaults', (action, answer) => {
					var s = action.split(/:/)
					var act = {
						id: shortid.generate(),
						label: action,
						instance: s[0],
						action: s[1],
						options: {},
					}

					const definition = this.getActionDefinition(act.instance, act.action)
					if (definition) {
						if (definition.options !== undefined && definition.options.length > 0) {
							for (var j in definition.options) {
								var opt = definition.options[j]
								act.options[opt.id] = opt.default
							}
						}
					}

					answer(act)
				})

				client.on('bank_action_add', (page, bank, set, action, answer) => {
					if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
					if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}
					if (this.bank_action_sets[page][bank][set] === undefined) {
						// cant implicitly create a set
						this.debug(`Missing set ${page}.${bank}:${set}`)
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

					const definition = this.getActionDefinition(act.instance, act.action)
					if (definition) {
						if (definition.options !== undefined && definition.options.length > 0) {
							for (var j in definition.options) {
								var opt = definition.options[j]
								act.options[opt.id] = opt.default
							}
						}
					}

					this.bank_action_sets[page][bank][set].push(act)

					const instance = this.instance.moduleHost.getChild(act.instance)
					if (instance) {
						instance.actionUpdate(act, page, bank).catch((e) => {
							this.debug(`action_update to connection failed: ${e.message}`)
						})
					}

					this.system.emit('action_save')
					if (typeof answer === 'function') {
						answer(this.bank_action_sets[page][bank][set])
					}
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_action_delete', (page, bank, set, id, answer) => {
					const action_set = (this.bank_action_sets[page][bank] || {})[set]
					if (action_set) {
						for (let i = 0; i < action_set.length; i++) {
							if (action_set[i].id == id) {
								const instance = this.instance.moduleHost.getChild(action_set[i].instance)
								if (instance) {
									instance.actionDelete(action_set[i]).catch((e) => {
										this.debug(`action_delete to connection failed: ${e.message}`)
									})
								}
								action_set.splice(i, 1)
								break
							}
						}
					}

					this.system.emit('action_save')
					if (typeof answer === 'function') {
						answer(this.bank_action_sets[page][bank][set])
					}
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_action_sets_list', (page, bank, answer) => {
					if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
					if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}
					if (typeof answer === 'function') {
						answer(Object.keys(this.bank_action_sets[page][bank]))
					}
				})
				client.on('bank_action_sets_append', (page, bank, answer) => {
					this.bank_set_append(page, bank)
					if (typeof answer === 'function') {
						answer(Object.keys(this.bank_action_sets[page][bank]))
					}
				})
				client.on('bank_action_sets_remove', (page, bank, set, answer) => {
					this.bank_set_remove(page, bank, set)
					if (typeof answer === 'function') {
						answer(Object.keys(this.bank_action_sets[page][bank]))
					}
				})
				client.on('bank_action_sets_swap', (page, bank, set1, set2, answer) => {
					this.bank_set_swap(page, bank, set1, set2)
					if (typeof answer === 'function') {
						answer(Object.keys(this.bank_action_sets[page][bank]))
					}
				})

				client.on('bank_action_sets_step', (page, bank, answer) => {
					answer(this.bank_cycle_step[page][bank])
				})

				client.on('bank_action_sets_step_set', (page, bank, set, answer) => {
					this.bank_set_next_step(page, bank, set)
					answer()
				})

				client.on('bank_action_sets_get', (page, bank, set, answer) => {
					if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
					if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}
					if (typeof answer === 'function') {
						answer(this.bank_action_sets[page][bank][set])
					}
				})

				client.on('bank_update_action_option_order', (page, bank, set, old_index, new_index) => {
					const action_set = (this.bank_action_sets[page][bank] || {})[set]
					if (action_set) {
						action_set.splice(new_index, 0, action_set.splice(old_index, 1)[0])
						this.system.emit('action_save')
					}
				})
			})
		})

		this.system.on('action_subscribe_bank', (page, bank) => {
			if (this.bank_action_sets[page] !== undefined && this.bank_action_sets[page][bank] !== undefined) {
				for (var set in this.bank_action_sets[page][bank]) {
					const action_set = this.bank_action_sets[page][bank][set]
					if (action_set) {
						const ps = []
						for (let i = 0; i < action_set.length; i++) {
							const instance = this.instance.moduleHost.getChild(action_set[i].instance)
							if (instance) {
								ps.push(instance.actionUpdate(action_set[i], page, bank))
							}
						}
						Promise.all(ps).catch((e) => {
							this.debug(`action_subscribe_bank for ${page}.${bank} failed: ${e.message}`)
						})
					}
				}
			}
		})

		this.system.on('action_unsubscribe_bank', (page, bank) => {
			if (this.bank_action_sets[page] !== undefined && this.bank_action_sets[page][bank] !== undefined) {
				for (var set in this.bank_action_sets[page][bank]) {
					const action_set = this.bank_action_sets[page][bank][set]
					if (action_set) {
						const ps = []
						for (let i = 0; i < action_set.length; i++) {
							const instance = this.instance.moduleHost.getChild(action_set[i].instance)
							if (instance) {
								ps.push(instance.actionDelete(action_set[i]))
							}
						}
						Promise.all(ps).catch((e) => {
							this.debug(`action_unsubscribe_bank for ${page}.${bank} failed: ${e.message}`)
						})
					}
				}
			}
		})

		this.system.on('bank_reset', (page, bank) => {
			this.system.emit('action_unsubscribe_bank', page, bank)

			if (this.bank_action_sets[page] === undefined) {
				this.bank_action_sets[page] = {}
			}
			this.bank_action_sets[page][bank] = {}

			this.debug('bank_reset()', page, bank)

			this.system.emit('action_save')
		})
	}

	/**
	 * Set the action definitions for an instance
	 * @access public
	 * @param {string} instance_id
	 * @param {object} actions
	 */
	setActionDefinitions(instance_id, actions) {
		this.action_definitions[instance_id] = actions
		this.io.emit('action_instance_definitions_set', instance_id, actions)
	}

	/**
	 * Check the status of a bank, and re-draw if needed
	 * @access protected
	 * @param {number} page
	 * @param {number} bank
	 */
	checkBankStatus(page, bank) {
		const instance_ids = new Set()
		const action_sets = (this.bank_action_sets[page] || {})[bank] || {}

		// Find all the instances referenced by the bank
		for (let set in action_sets) {
			if (action_sets[set]) {
				for (const action of action_sets[set]) {
					instance_ids.add(action.instance)
				}
			}
		}

		// Figure out the combined status
		let status = 0
		for (const instance_id of instance_ids) {
			const instance_status = this.instance.getInstanceStatus(instance_id)
			if (instance_status !== undefined && status < instance_status[0]) {
				status = instance_status[0]
			}
		}

		// If the status has changed, emit the eent
		if (status != this.bank_status[page + '_' + bank]) {
			this.bank_status[page + '_' + bank] = status
			this.system.emit('action_bank_status_set', page, bank, status)
		}
	}

	getActionDefinition(instance_id, action) {
		if (this.action_definitions[instance_id]) {
			return this.action_definitions[instance_id][action]
		} else {
			return undefined
		}
	}

	/**
	 * Call a function on each action on a bank
	 * Provides, 'action, page, bank, set, index' as parameters to the callback
	 * @param {function} cb - function to execute for each action
	 */
	iterateActions(cb) {
		this.iterateActionSets((arr, page, bank, set) => {
			for (var i = 0; i < arr.length; ++i) {
				cb(arr[i], page, bank, set, i)
			}
		})
	}

	/**
	 * Call a function on each action-set
	 * Provides, 'actions, page, bank, set' as parameters to the callback
	 * @param {function} cb - function to execute for each action-set
	 */
	iterateActionSets(cb) {
		for (var page in this.bank_action_sets) {
			for (var bank in this.bank_action_sets[page]) {
				if (this.bank_action_sets[page][bank] !== undefined) {
					for (var set in this.bank_action_sets[page][bank]) {
						if (this.bank_action_sets[page][bank][set] !== undefined) {
							cb(this.bank_action_sets[page][bank][set], page, bank, set)
						}
					}
				}
			}
		}
	}

	bank_set_append(page, bank) {
		if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
		if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}

		let bank_config = this.bank.getBank(page, bank)

		if (bank_config && bank_config.style === 'step') {
			const existingKeys = Object.keys(this.bank_action_sets[page][bank])
				.map((k) => Number(k))
				.filter((k) => !isNaN(k))
			if (existingKeys.length === 0) {
				// add the default '0' set
				this.bank_action_sets[page][bank]['0'] = []
			} else {
				// add one after the last
				const max = Math.max(...existingKeys)
				this.bank_action_sets[page][bank][`${max + 1}`] = []
			}
		}

		this.io.emit('bank_action_sets_list', page, bank, Object.keys(this.bank_action_sets[page][bank]))
	}

	bank_set_step_change(page, bank, value) {
		// notify internal module
		const index = Object.keys(this.bank_action_sets[page][bank]).indexOf(value)
		this.system.emit('bank_action_sets_step', page, bank, index === -1 ? 0 : index)

		// notify ui
		this.io.emit('bank_action_sets_step', page, bank, value)
	}

	bank_set_remove(page, bank, id) {
		if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
		if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}

		let bank_config = this.bank.getBank(page, bank)

		if (bank_config && bank_config.style === 'step') {
			const oldKeys = Object.keys(this.bank_action_sets[page][bank])

			if (oldKeys.length > 1) {
				// Assume it exists
				delete this.bank_action_sets[page][bank][id]

				// Update the next step
				const oldIndex = oldKeys.indexOf(id)
				let newIndex = oldIndex + 1
				if (newIndex >= oldKeys.length) {
					newIndex = 0
				}
				if (newIndex !== oldIndex) {
					this.bank_cycle_step[page][bank] = oldKeys[newIndex]
					this.bank_set_step_change(page, bank, oldKeys[newIndex])
					this.system.emit('graphics_bank_invalidate', page, bank)
				}
			}
		}

		this.io.emit('bank_action_sets_list', page, bank, Object.keys(this.bank_action_sets[page][bank]))
	}

	bank_set_swap(page, bank, id1, id2) {
		if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
		if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}

		if (this.bank_action_sets[page][bank][id1] && this.bank_action_sets[page][bank][id2]) {
			let bank_config = this.bank.getBank(page, bank)

			if (bank_config && bank_config.style === 'step') {
				const tmp = this.bank_action_sets[page][bank][id1]
				this.bank_action_sets[page][bank][id1] = this.bank_action_sets[page][bank][id2]
				this.bank_action_sets[page][bank][id2] = tmp
			}
		}

		// tell the ui to reload the sets
		this.io.emit('bank_action_sets_reload', page, bank, [id1, id2])
	}

	bank_set_next_step(page, bank, set) {
		if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
		if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}

		if (this.bank_action_sets[page][bank][set]) {
			let bank_config = this.bank.getBank(page, bank)

			if (bank_config && bank_config.style === 'step') {
				this.bank_cycle_step[page][bank] = set
				this.bank_set_step_change(page, bank, set)
				this.system.emit('graphics_bank_invalidate', page, bank)
			}
		}
	}
}

module.exports = BankAction

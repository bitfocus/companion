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
const { sendResult } = require('./resources/util')

class action {
	debug = require('debug')('lib/action')

	constructor(system) {
		this.system = system
		this.actions = {}
		this.bank_actions = {}
		this.bank_release_actions = {}
		this.bank_status = {}
		this.instance = {}
		this.actions_running = new Set()
		this.timers_running = new Map()

		this.system.emit('db_get', 'bank_actions', (res) => {
			if (res !== undefined) {
				this.bank_actions = res
			}
		})

		this.system.emit('db_get', 'bank_release_actions', (res) => {
			if (res !== undefined) {
				this.bank_release_actions = res
			}
		})

		this.system.on('15to32', () => {
			// Convert config from 15 to 32 keys format
			for (const page in this.config) {
				for (const bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
					if (this.bank_actions[page][bank] === undefined) {
						this.bank_actions[page][bank] = []
					}
					if (this.bank_release_actions[page][bank] === undefined) {
						this.bank_release_actions[page][bank] = []
					}
				}
			}
		})

		this.system.on('instance', (obj) => {
			this.debug('got instance')
			this.instance = obj

			// ensure all actions are valid
			this.bank_actions = this.cleanupActionsList(this.bank_actions)
			this.bank_release_actions = this.cleanupActionsList(this.bank_release_actions)

			this.system.emit('db_set', 'bank_actions', this.bank_actions)
			this.system.emit('db_set', 'bank_release_actions', this.bank_release_actions)
			this.system.emit('db_save')
		})

		this.system.on('action_save', () => {
			this.system.emit('db_set', 'bank_actions', this.bank_actions)
			this.system.emit('db_set', 'bank_release_actions', this.bank_release_actions)
			this.system.emit('db_save')
			this.debug('saving')
		})

		this.system.on('instance_save', () => {
			setImmediate(() => {
				this.io.emit('actions', this.actions)
			})
		})

		this.system.on('instance_delete', (id) => {
			for (const page in this.bank_actions) {
				for (const bank in this.bank_actions[page]) {
					if (this.bank_actions[page][bank] !== undefined) {
						for (let i = 0; i < this.bank_actions[page][bank].length; ++i) {
							const action = this.bank_actions[page][bank][i]

							if (action.instance == id) {
								this.debug('Deleting action ' + i + ' from button ' + page + '.' + bank)
								this.unsubscribeAction(this.bank_actions[page][bank][i])
								this.bank_actions[page][bank].splice(i, 1)
								this.system.emit('instance_status_check_bank', page, bank)
								i--
							}
						}
					}
				}
			}

			for (const page in this.bank_release_actions) {
				for (const bank in this.bank_release_actions[page]) {
					if (this.bank_release_actions[page][bank] !== undefined) {
						for (let i = 0; i < this.bank_release_actions[page][bank].length; ++i) {
							const action = this.bank_release_actions[page][bank][i]
							if (action.instance == id) {
								this.debug('Deleting release action ' + i + ' from button ' + page + '.' + bank)
								this.unsubscribeAction(this.bank_release_actions[page][bank][i])
								this.bank_release_actions[page][bank].splice(i, 1)
								this.system.emit('instance_status_check_bank', page, bank)
								i--
							}
						}
					}
				}
			}
		})

		this.system.on('action_get_banks', (cb) => {
			cb(this.bank_actions)
		})

		this.system.on('release_action_get_banks', (cb) => {
			cb(this.bank_release_actions)
		})

		this.system.on('actions_for_instance', (instance_id, cb) => {
			let actions = []
			for (const page in this.bank_actions) {
				for (const bank in this.bank_actions[page]) {
					for (const i in this.bank_actions[page][bank]) {
						let action = this.bank_actions[page][bank][i]
						if (action.instance == instance_id) {
							actions.push(action)
						}
					}
				}
			}

			this.system.emit('schedule_get_all_actions', (_actions) => {
				for (const action of _actions) {
					if (action.instance == instance_id) {
						actions.push(action)
					}
				}
			})

			cb(actions)
		})

		this.system.on('release_actions_for_instance', (instance_id, cb) => {
			let actions = []
			for (const page in this.bank_release_actions) {
				for (const bank in this.bank_release_actions[page]) {
					for (const i in this.bank_release_actions[page][bank]) {
						let action = this.bank_release_actions[page][bank][i]
						if (action.instance == instance_id) {
							actions.push(action)
						}
					}
				}
			}
			cb(actions)
		})

		this.system.on('action_bank_status_get', (page, bank, cb) => {
			cb(this.bank_status[page + '_' + bank])
		})

		this.system.on('instance_status_check_bank', (page, bank) => {
			this.checkBank(page, bank)
		})

		this.system.on('instance_status_set', (instance, level, msg) => {
			for (let page in this.bank_actions) {
				if (this.bank_actions[page] !== undefined) {
					for (let bank in this.bank_actions[page]) {
						if (this.bank_actions[page][bank] !== undefined) {
							for (let i = 0; i < this.bank_actions[page][bank].length; ++i) {
								const action = this.bank_actions[page][bank][i]
								if (action.instance == instance) {
									this.checkBank(page, bank)
								}
							}
						}
					}
				}
			}

			for (let page in this.bank_release_actions) {
				for (let bank in this.bank_release_actions[page]) {
					if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
						for (let i = 0; i < this.bank_release_actions[page][bank].length; ++i) {
							const action = this.bank_release_actions[page][bank][i]
							if (action.instance == instance) {
								this.checkBank(page, bank)
							}
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

			let actions_running = this.actions_running //clone hack
			this.actions_running = new Set() // clear the array

			for (let bid of actions_running.keys()) {
				const a = bid.split('_')
				this.system.emit('graphics_bank_invalidate', a[0], a[1])
			}
		})

		// skipUp needed to abort 'up' actions on non-latch buttons
		let skipUp = {}

		// If a user wants to abort a single button actions
		this.system.on('action_abort_bank', (page, bank, unlatch) => {
			let bid = page + '_' + bank
			let cleared = 0

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
			if (unlatch) {
				this.system.emit('graphics_indicate_push', page, bank, false)
				skipUp[page + '_' + bank] = true
			}

			if (cleared > 0) {
				this.system.emit('graphics_bank_invalidate', page, bank)
			}
		})

		// skipNext needed for 'bank_pressed' callback
		let skipNext = {}
		const pageStyles = ['pageup', 'pagenum', 'pagedown']

		this.system.on('bank_pressed', (page, bank, direction, deviceid) => {
			let bank_config
			const pb = page + '_' + bank

			this.system.emit('get_bank', page, bank, (config) => {
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
				this.system.emit('graphics_is_pushed', page, bank, (isPushed) => {
					// button is being pressed but not yet latched
					// the next button-release from this device needs to be skipped
					// because the 'release' would immediately un-latch the button
					if (direction && !isPushed) {
						skipNext[pb] = deviceid
					} else if (direction && isPushed) {
						// button is latched, prevent duplicate down actions
						// the following 'release' will run the up actions
						reject = true
					} else if (!(direction || isPushed)) {
						// button is up, prevent duplicate up actions
						reject = true
					}
				})

				if (reject) {
					//this.debug("Latch button duplicate " + (direction? "down":"up") )
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
						this.system.emit('device_page_up', deviceid)
					} else if (bank_config.style == 'pagenum') {
						this.system.emit('device_page_set', deviceid, 1)
					} else if (bank_config.style == 'pagedown') {
						this.system.emit('device_page_down', deviceid)
					}
				}
				// no actions allowed on page buttons so we're done
				return
			}

			this.system.emit('graphics_indicate_push', page, bank, direction, deviceid)

			let obj = this.bank_actions

			// find release actions if the direction is up
			if (direction === false) {
				obj = this.bank_release_actions
			}

			if (obj[page] === undefined || obj[page][bank] === undefined || obj[page][bank].length === 0) {
				return
			}

			this.debug('found actions')

			const bankId = `${page}_${bank}`
			this.system.emit('action_run_multiple', obj[page][bank], bankId, bank_config.relative_delay, {
				deviceid: deviceid,
				page: page,
				bank: bank,
			})
		})

		this.system.on('action_run_multiple', (actions, groupId, relative_delay, run_source) => {
			// Handle whether the delays are absolute or relative.
			let action_delay = 0
			for (const n in actions) {
				let a = actions[n]
				let this_delay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay)

				if (relative_delay) {
					// Relative delay: each action's delay adds to the next.
					action_delay += this_delay
				} else {
					// Absolute delay: each delay is its own.
					action_delay = this_delay
				}

				// Create the property .effective_delay. Don't change the user's .delay property.
				a.effective_delay = action_delay
			}

			let has_delayed = false
			for (const n in actions) {
				let a = actions[n]
				let delay = a.effective_delay === undefined ? 0 : parseInt(a.effective_delay)
				delete a.effective_delay

				this.debug('Running action', a)

				if (this.instance !== undefined && this.instance.store !== undefined && this.instance.store.db !== undefined) {
					if (
						this.instance.store.db[a.instance] !== undefined &&
						this.instance.store.db[a.instance].enabled !== false
					) {
						// is this a timedelayed action?
						if (delay > 0) {
							has_delayed = true
							;((action, delay_time) => {
								let timer = setTimeout(() => {
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
					} else {
						this.debug('not running action for disabled instance')
					}
				} else {
					this.debug("wow, instance store didn't exist")
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
			if (this.instance !== undefined && this.instance.store !== undefined && this.instance.store.db !== undefined) {
				this.system.emit('instance_get', action.instance, (instance) => {
					if (
						this.instance.store.db[action.instance] !== undefined &&
						this.instance.store.db[action.instance].enabled !== false
					) {
						const definition = this.actions[`${action.instance}:${action.action}`]

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
								this.debug(
									`ERROR: instance "${instance.label}" does not have a handler for the "${action.action}" action`
								)
							}
						} catch (e) {
							this.system.emit(
								'log',
								'instance(' + instance.label + ')',
								'warn',
								'Error executing action: ' + e.message
							)
						}
					} else {
						this.debug('trying to run action on a deleted instance.', action)
					}
				})
			}
		})

		this.system.emit('io_get', (io) => {
			this.io = io
			this.system.on('io_connect', (client) => {
				client.on('get_actions', () => {
					client.emit('actions', this.actions)
				})

				client.on('bank_update_action_delay', (page, bank, action, value) => {
					const bp = this.bank_actions[page][bank]
					if (bp !== undefined) {
						for (const n in bp) {
							const obj = bp[n]
							if (obj !== undefined && obj.id === action) {
								this.bank_actions[page][bank][n].delay = value
								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('bank_update_release_action_delay', (page, bank, action, value) => {
					const bp = this.bank_release_actions[page][bank]
					if (bp !== undefined) {
						for (const n in bp) {
							const obj = bp[n]
							if (obj !== undefined && obj.id === action) {
								this.bank_release_actions[page][bank][n].delay = value
								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('bank_update_action_option', (page, bank, action, option, value) => {
					this.debug('bank_update_action_option', page, bank, action, option, value)
					const bp = this.bank_actions[page][bank]
					if (bp !== undefined) {
						for (const n in bp) {
							let obj = bp[n]
							if (obj !== undefined && obj.id === action) {
								this.unsubscribeAction(obj)
								if (obj.options === undefined) {
									obj.options = {}
								}
								obj.options[option] = value
								this.subscribeAction(obj)
								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('bank_release_action_update_option', (page, bank, action, option, value) => {
					this.debug('bank_release_action_update_option', page, bank, action, option, value)
					const bp = this.bank_release_actions[page][bank]
					if (bp !== undefined) {
						for (const n in bp) {
							let obj = bp[n]
							if (obj !== undefined && obj.id === action) {
								this.unsubscribeAction(obj)
								if (obj.options === undefined) {
									obj.options = {}
								}
								obj.options[option] = value
								this.subscribeAction(obj)
								this.system.emit('action_save')
							}
						}
					}
				})

				client.on('action_get_defaults', (action, answer) => {
					let s = action.split(/:/)
					let act = {
						id: shortid.generate(),
						label: action,
						instance: s[0],
						action: s[1],
						options: {},
					}

					if (!this.instance.store.db[act.instance]) {
						// Action is not valid
						return
					}

					if (this.actions[action] !== undefined) {
						const definition = this.actions[action]

						if (definition.options !== undefined && definition.options.length > 0) {
							for (const j in definition.options) {
								let opt = definition.options[j]
								act.options[opt.id] = opt.default
							}
						}
					}

					answer(act)
				})

				client.on('bank_action_add', (page, bank, action, answer) => {
					if (this.bank_actions[page] === undefined) this.bank_actions[page] = {}
					if (this.bank_actions[page][bank] === undefined) this.bank_actions[page][bank] = []
					let s = action.split(/:/)

					let act = {
						id: shortid.generate(),
						label: action,
						instance: s[0],
						action: s[1],
						options: {},
					}

					if (!this.instance.store.db[act.instance]) {
						// Action is not valid
						return
					}

					if (this.actions[action] !== undefined) {
						const definition = this.actions[action]

						if (definition.options !== undefined && definition.options.length > 0) {
							for (const j in definition.options) {
								let opt = definition.options[j]
								act.options[opt.id] = opt.default
							}
						}
					}

					this.bank_actions[page][bank].push(act)
					this.subscribeAction(act)

					this.system.emit('action_save')
					sendResult(answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank])
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_addReleaseAction', (page, bank, action, answer) => {
					if (this.bank_release_actions[page] === undefined) this.bank_release_actions[page] = {}
					if (this.bank_release_actions[page][bank] === undefined) this.bank_release_actions[page][bank] = []
					let s = action.split(/:/)

					let act = {
						id: shortid.generate(),
						label: action,
						instance: s[0],
						action: s[1],
						options: {},
					}

					if (!this.instance.store.db[act.instance]) {
						// Action is not valid
						return
					}

					if (this.actions[action] !== undefined) {
						const definition = this.actions[action]

						if (definition.options !== undefined && definition.options.length > 0) {
							for (const j in definition.options) {
								let opt = definition.options[j]
								act.options[opt.id] = opt.default
							}
						}
					}

					this.bank_release_actions[page][bank].push(act)
					this.subscribeAction(act)

					this.system.emit('action_save')
					sendResult(answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank])
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_action_delete', (page, bank, id, answer) => {
					const ba = this.bank_actions[page][bank]

					for (const n in ba) {
						if (ba[n].id == id) {
							this.unsubscribeAction(this.bank_actions[page][bank][n])
							delete this.bank_actions[page][bank][n]
							break
						}
					}

					let cleanup = []

					for (const n in ba) {
						if (ba[n] !== null) {
							cleanup.push(ba[n])
						}
					}

					this.bank_actions[page][bank] = cleanup

					this.system.emit('action_save')
					sendResult(answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank])
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_release_action_delete', (page, bank, id, answer) => {
					const ba = this.bank_release_actions[page][bank]

					for (const n in ba) {
						if (ba[n].id == id) {
							this.unsubscribeAction(this.bank_release_actions[page][bank][n])
							delete this.bank_release_actions[page][bank][n]
							break
						}
					}

					let cleanup = []

					for (const n in ba) {
						if (ba[n] !== null) {
							cleanup.push(ba[n])
						}
					}

					this.bank_release_actions[page][bank] = cleanup

					this.system.emit('action_save')
					sendResult(answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank])
					this.system.emit('instance_status_check_bank', page, bank)
				})

				client.on('bank_actions_get', (page, bank, answer) => {
					if (this.bank_actions[page] === undefined) this.bank_actions[page] = {}
					if (this.bank_actions[page][bank] === undefined) this.bank_actions[page][bank] = []
					sendResult(answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank])
				})

				client.on('bank_release_actions_get', (page, bank, answer) => {
					if (this.bank_release_actions[page] === undefined) this.bank_release_actions[page] = {}
					if (this.bank_release_actions[page][bank] === undefined) this.bank_release_actions[page][bank] = []
					sendResult(answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank])
				})

				client.on('bank_update_action_option_order', (page, bank, old_index, new_index) => {
					let bp = this.bank_actions[page][bank]
					if (bp !== undefined) {
						bp.splice(new_index, 0, bp.splice(old_index, 1)[0])
						this.system.emit('action_save')
					}
				})

				client.on('bank_release_action_update_option_order', (page, bank, old_index, new_index) => {
					let bp = this.bank_release_actions[page][bank]
					if (bp !== undefined) {
						bp.splice(new_index, 0, bp.splice(old_index, 1)[0])
						this.system.emit('action_save')
					}
				})
			})
		})

		this.system.on('instance_delete', (id) => {
			for (let n in this.actions) {
				const x = n.split(/:/)
				if (x[0] == id) {
					delete this.actions[n]
				}
			}
			this.system.emit('actions_update')
		})

		this.system.on('action_subscribe', (action) => {
			this.subscribeAction(action)
		})

		this.system.on('action_unsubscribe', (action) => {
			this.unsubscribeAction(action)
		})

		this.system.on('action_subscribe_bank', (page, bank) => {
			if (this.bank_actions[page] !== undefined && this.bank_actions[page][bank] !== undefined) {
				// find all instance-ids in actions for bank
				for (const i in this.bank_actions[page][bank]) {
					this.subscribeAction(this.bank_actions[page][bank][i])
				}
			}
			if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
				// find all instance-ids in release_actions for bank
				for (const i in this.bank_release_actions[page][bank]) {
					this.subscribeAction(this.bank_release_actions[page][bank][i])
				}
			}
		})

		this.system.on('action_unsubscribe_bank', (page, bank) => {
			if (this.bank_actions[page] !== undefined && this.bank_actions[page][bank] !== undefined) {
				// find all instance-ids in actions for bank
				for (const i in this.bank_actions[page][bank]) {
					this.unsubscribeAction(this.bank_actions[page][bank][i])
				}
			}
			if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
				// find all instance-ids in release_actions for bank
				for (const i in this.bank_release_actions[page][bank]) {
					this.unsubscribeAction(this.bank_release_actions[page][bank][i])
				}
			}
		})

		this.system.on('bank_reset', (page, bank) => {
			this.system.emit('action_unsubscribe_bank', page, bank)

			if (this.bank_actions[page] === undefined) {
				this.bank_actions[page] = {}
			}
			this.bank_actions[page][bank] = []

			if (this.bank_release_actions[page] === undefined) {
				this.bank_release_actions[page] = {}
			}
			this.bank_release_actions[page][bank] = []

			this.debug('bank_reset()', page, bank, this.bank_actions[page][bank])

			this.system.emit('action_save')
		})

		this.system.on('actions_update', () => {
			this.debug('actions_update:', this.actions)
			this.io.emit('actions', this.actions)
		})

		this.system.on('instance_actions', (id, actions) => {
			let newActions = {}
			// actions[instance_id:action]
			for (let m in this.actions) {
				const idActionSplit = m.split(':')
				// only add other id actions.
				if (idActionSplit[0] != id) {
					newActions[m] = this.actions[m]
				}
			}
			// overwrite old action array with cleared one
			this.actions = newActions

			for (const n in actions) {
				let a = actions[n]
				this.actions[id + ':' + n] = a
				this.debug('adding action', id + ':' + n)
			}
			this.io.emit('actions', this.actions)
		})
	}

	checkBank(page, bank) {
		let status = 0

		if (this.bank_actions[page] === undefined || this.bank_actions[page][bank] === undefined) {
			return
		}
		for (let i = 0; i < this.bank_actions[page][bank].length; ++i) {
			const action = this.bank_actions[page][bank][i]
			this.system.emit('instance_status_get', action.instance, (instance_status) => {
				if (instance_status !== undefined && status < instance_status[0]) {
					status = instance_status[0]
				}
			})
		}

		if (status != this.bank_status[page + '_' + bank]) {
			this.bank_status[page + '_' + bank] = status
			this.system.emit('action_bank_status_set', page, bank, status)
		}
	}

	cleanupActionsList(actions) {
		const res = {}

		for (const page in actions) {
			res[page] = {}
			for (const bank in actions[page]) {
				res[page][bank] = []

				if (actions[page][bank] !== undefined) {
					for (let i = 0; i < actions[page][bank].length; ++i) {
						const action = actions[page][bank][i]
						if (action && this.instance.store.db[action.instance]) {
							res[page][bank].push(action)
						}
					}
				}
			}
		}

		return res
	}

	subscribeAction(action) {
		if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
			const actionId = `${action.instance}:${action.action}`
			if (this.actions[actionId] !== undefined) {
				let definition = this.actions[actionId]
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(action)
				}
			}
		}
	}

	unsubscribeAction(action) {
		if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
			const actionId = `${action.instance}:${action.action}`
			if (this.actions[actionId] !== undefined) {
				let definition = this.actions[actionId]
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(action)
				}
			}
		}
	}
}

exports = module.exports = function (system) {
	return new action(system)
}

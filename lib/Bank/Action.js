import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

/**
 * The class that manages the bank actions
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */

class BankAction extends CoreBase {
	actions_running = new Set()
	bank_action_sets
	bank_cycle_step = {}
	bank_status = {}
	timers_running = new Map()

	abortAll() {
		this.logger.silly('Aborting delayed actions')

		for (let timer of this.timers_running.keys()) {
			this.logger.silly('clearing timer')
			clearTimeout(timer)
		}
		this.timers_running.clear()

		var actions_running = this.actions_running //clone hack
		this.actions_running = new Set() // clear the array

		for (let bid of actions_running.keys()) {
			const a = bid.split('_')
			this.graphics.invalidateBank(a[0], a[1])
		}
	}

	abortBank(page, bank, skip_up) {
		var bid = page + '_' + bank
		var cleared = 0

		this.actions_running.delete(bid)

		this.timers_running.forEach((timerId, timer) => {
			if (timerId === bid) {
				if (cleared == 0) {
					this.logger.silly('Aborting button ', page, ',', bank)
				}
				clearTimeout(timer)
				this.timers_running.delete(timer)
				cleared += 1
			}
		})

		// if requested, reset and skip up-actions
		if (skip_up) {
			this.bank.setPushed(page, bank, false)
		}
	}

	/**
	 * Get the entire feedback table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Object} the feedbacks
	 * @access public
	 */
	getAll(clone = false) {
		let out

		if (this.feedbacks !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.bank_action_sets)
			} else {
				out = this.bank_action_sets
			}
		}

		return out
	}

	/**
	 * Import a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {Object} imp - the import config
	 * @access public
	 */
	importBank(page, bank, imp) {
		if (!imp) {
			if (this.bank_action_sets[page] === undefined) {
				this.bank_action_sets[page] = {}
			}
			if (this.bank_action_sets[page][bank] === undefined) {
				this.bank_action_sets[page][bank] = {}
			}
		} else {
			for (let set in imp) {
				const actions_set = imp[set]
				for (const action of actions_set) {
					action.id = nanoid()
				}
			}

			this.bank_action_sets[page][bank] = imp
		}

		this.subscribeBank(page, bank)
	}

	exportBank(page, bank) {
		return cloneDeep(this.bank_action_sets[page][bank])
	}

	onBankStepDelta(page, bank, amount) {
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
	}

	onBankStepSet(page, bank, step) {
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
	}

	pressBank(page, bank, direction, deviceid) {
		// 0 is not valid, so do falsey checks to make sure parameters look sane
		if (!page || !bank) return

		var bank_config = this.bank.get(page, bank)

		this.triggers.onBankPress(page, bank, direction, deviceid)

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
			const is_pushed = this.bank.isPushed(page, bank)

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
				this.surfaces.devicePageUp(deviceid)
			}
			return
		} else if (bank_config.style == 'pagenum') {
			if (direction) {
				this.surfaces.devicePageSet(deviceid, 1)
			}
			return
		} else if (bank_config.style == 'pagedown') {
			if (direction) {
				this.surfaces.devicePageDown(deviceid)
			}
			return
		}

		// track the new push state, and redraw
		this.bank.setPushed(page, bank, direction, deviceid)

		if (
			!action_set_id ||
			!this.bank_action_sets[page] ||
			!this.bank_action_sets[page][bank] ||
			!this.bank_action_sets[page][bank][action_set_id]
		) {
			return
		}
		const actions = this.bank_action_sets[page][bank][action_set_id]

		this.logger.silly('found actions')

		const bankId = `${page}_${bank}`
		this.runMultipleActions(actions, bankId, bank_config.relative_delay, {
			deviceid: deviceid,
			page: page,
			bank: bank,
		})
	}

	/**
	 * Replace a action on a bank with an updated version
	 * @param {number} page
	 * @param {number} bank
	 * @param {object} action
	 */
	replaceItem(page, bank, newProps) {
		if (this.bank_action_sets[page] && this.bank_action_sets[page][bank]) {
			for (const actionSet of Object.values(this.bank_action_sets[page][bank])) {
				for (const action of actionSet) {
					// Replace the new feedback in place
					if (action.id === newProps.id) {
						action.action = newProps.actionId
						action.options = newProps.options

						delete action.upgradeIndex

						return true
					}
				}
			}
		}

		return false
	}

	runAction(action, extras) {
		if (action.instance === 'internal') {
			this.internalModule.executeAction(action, extras)
		} else {
			const instance = this.instance.moduleHost.getChild(action.instance)
			if (instance) {
				instance.actionRun(action, extras).catch((e) => {
					this.logger.silly(`Error executing action for ${instance.connectionId}: ${e.message}`)
					this.registry.log.add(`instance(${instance.connectionId})`, 'warn', 'Error executing action: ' + e.message)
				})
			} else {
				this.logger.silly('trying to run action on a missing instance.', action)
			}
		}
	}

	runMultipleActions(actions, groupId, relative_delay, run_source) {
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

			this.logger.silly('Running action', a)

			// is this a timedelayed action?
			if (delay > 0) {
				has_delayed = true
				;((action, delay_time) => {
					var timer = setTimeout(() => {
						this.runAction(action, run_source)

						this.timers_running.delete(timer)

						// Stop timer-indication
						const hasAnotherTimer = Array.from(this.timers_running.values()).find((v) => v === groupId)
						if (hasAnotherTimer === undefined) {
							this.actions_running.delete(groupId)
							if (run_source) {
								this.graphics.invalidateBank(run_source.page, run_source.bank)
							}
						}
					}, delay_time)

					this.timers_running.set(timer, groupId)
				})(a, delay)
			}

			// or is it immediate
			else {
				this.runAction(a, run_source)
			}
		}

		if (has_delayed) {
			// Start timer-indication
			this.actions_running.add(groupId)

			if (run_source) {
				this.graphics.invalidateBank(run_source.page, run_source.bank)
			}
		}
	}

	subscribeBank(page, bank) {
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
						this.logger.silly(`action_subscribe_bank for ${page}.${bank} failed: ${e.message}`)
					})
				}
			}
		}
	}

	bank_set_step_change(page, bank, value) {
		// // notify internal module
		// const index = Object.keys(this.bank_action_sets[page][bank]).indexOf(value)
		// this.system.emit('bank_action_sets_step', page, bank, index === -1 ? 0 : index)
		// TODO

		// notify ui
		this.io.emit('bank_action_sets_step', page, bank, value)
	}

	bank_set_next_step(page, bank, set) {
		if (this.bank_action_sets[page] === undefined) this.bank_action_sets[page] = {}
		if (this.bank_action_sets[page][bank] === undefined) this.bank_action_sets[page][bank] = {}

		if (this.bank_action_sets[page][bank][set]) {
			let bank_config = this.bank.get(page, bank)

			if (bank_config && bank_config.style === 'step') {
				this.bank_cycle_step[page][bank] = set
				this.bank_set_step_change(page, bank, set)
				this.graphics.invalidateBank(page, bank)
			}
		}
	}
}

export default BankAction

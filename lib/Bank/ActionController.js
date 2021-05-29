const CoreBase = require('../Core/Base')
const BankActionItems = require('./ActionItems')

/**
 * Class used by the {@link BankController} to manage and allow execution of actions
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 * @copyright 2021 Bitfocus AS
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
class BankActionController extends CoreBase {
	/**
	 * The page styles of: <code>'pageup'</code>, <code>'pagenum'</code>, <code>'pagedown'</code>
	 * @type {string[]}
	 * @static
	 */
	static PageStyles = ['pageup', 'pagenum', 'pagedown']
	/** @type {BankActionItems} */
	actions
	/** @type {Set} */
	actionsRunning = new Set()
	/** @type {Object.<string, number>} */
	bankStatus = {}
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Bank/ActionController')
	/** @type {BankActionDefinition[]} */
	definitions = {}
	/** @type {Object.<string, string>} */
	skipNext = {}
	/** @type {Object.<string, boolean>} */
	skipUp = {}
	/** @type {BankActionItems} */
	releaseActions
	/** @type {Map} */
	timersRunning = new Map()

	constructor(registry) {
		super(registry, 'action')

		this.actions = new BankActionItems(registry, this, 'action', 'bank_actions')
		this.releaseActions = new BankActionItems(registry, this, 'release_action', 'bank_release_actions')

		// Permanent //
		this.system.on('action_abort_bank', this.abortSingleBank.bind(this))
		this.system.on('action_delayed_abort', this.abortDelayedActions.bind(this))
		this.system.on('action_run', this.runAction.bind(this))
		this.system.on('bank_pressed', this.bankPressed.bind(this))
		this.system.on('instance_actions', this.setInstanceDefinitions.bind(this))

		this.system.on('actions_for_instance', (id, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getInstanceActions(id))
			}
		})
		this.system.on('release_actions_for_instance', (id, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getInstanceReleaseActions(id))
			}
		})

		// Temporary //
		this.system.on('instance_delete', this.deleteInstance.bind(this))
		this.system.on('instance_status_set', this.checkInstanceStatus.bind(this))
	}

	abortDelayedActions() {
		this.debug('Aborting delayed actions')

		for (let timer of this.timersRunning.keys()) {
			this.debug('clearing timer')
			clearTimeout(timer)
		}

		this.timersRunning.clear()

		let actionsRunning = this.actionsRunning //clone hack
		this.actionsRunning = new Set() // clear the array

		for (let bid of actionsRunning.keys()) {
			const a = bid.split('_')
			this.graphics.invalidateBank(a[0], a[1])
		}
	}

	abortSingleBank(page, bank, unlatch) {
		var bid = page + '_' + bank
		var cleared = 0

		this.actionsRunning.delete(bid)

		this.timersRunning.forEach((timerId, timer) => {
			if (timerId === bid) {
				if (cleared == 0) {
					debug('Aborting button ', page, ',', bank)
				}
				clearTimeout(timer)
				this.timersRunning.delete(timer)
				cleared += 1
			}
		})

		// if requested, reset and skip up-actions
		if (unlatch) {
			this.system.emit('graphics_indicate_push', page, bank, false)
			this.skipUp[page + '_' + bank] = true
		}

		if (cleared > 0) {
			this.system.emit('graphics_bank_invalidate', page, bank)
		}
	}

	bankPressed(page, bank, direction, deviceid) {
		let bankConfig = this.bank.getBank(page, bank)
		let pb = page + '_' + bank

		if (bankConfig.latch) {
			let pb = page + '_' + bank

			if (deviceid == undefined) {
				// web buttons and osc don't set deviceid
				deviceid = 'osc-web'
			}

			if (this.skipNext[pb] != undefined) {
				// ignore release after latching press
				// from this device
				if (this.skipNext[pb] == deviceid) {
					delete this.skipNext[pb] // reduce memory creep
					return
				}
			}

			let reject = false
			this.system.emit('graphics_is_pushed', page, bank, function (pushed) {
				let isPushed = 1 == pushed ? true : false
				// button is being pressed but not yet latched
				// the next button-release from this device needs to be skipped
				// because the 'release' would immediately un-latch the button
				if (direction && !isPushed) {
					this.skipNext[pb] = deviceid
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

		if (this.skipUp[pb]) {
			delete this.skipUp[pb]
			if (!bankConfig.latch) {
				return
			}
		}

		// magic page keys only respond to push so ignore the release
		// they also don't have a 'pushed' graphics indication
		// so process the action and return before trying to
		// indicate 'pushed'. Otherwise when the 'unpush' graphics
		// occurs, it will re-draw the old button on the new (wrong) page
		if (BankActionController.PageStyles.includes(bankConfig.style)) {
			if (direction === true) {
				if (bankConfig.style == 'pageup') {
					this.system.emit('device_page_up', deviceid)
				} else if (bankConfig.style == 'pagenum') {
					this.system.emit('device_page_set', deviceid, 1)
				} else if (bankConfig.style == 'pagedown') {
					this.system.emit('device_page_down', deviceid)
				}
			}
			// no actions allowed on page buttons so we're done
			return
		}

		this.system.emit('graphics_indicate_push', page, bank, direction, deviceid)

		let obj

		// find release actions if the direction is up
		if (direction === false) {
			obj = this.releaseActions.getBank(page, bank)
		} else {
			obj = this.actions.getBank(page, bank)
		}

		if (obj === undefined || obj.length === 0) {
			return
		}

		this.debug('found actions')

		// Handle whether the delays are absolute or relative.
		let actionDelay = 0
		for (let n in obj) {
			let a = obj[n]
			let thisDelay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay)

			if (bankConfig.relative_delay) {
				// Relative delay: each action's delay adds to the next.
				actionDelay += thisDelay
			} else {
				// Absolute delay: each delay is its own.
				actionDelay = thisDelay
			}

			// Create the property .effectiveDelay. Don't change the user's .delay property.
			a.effectiveDelay = actionDelay
		}

		const bankId = `${page}_${bank}`

		let hasDelayed = false

		for (let n in obj) {
			let a = obj[n]
			let delay = a.effectiveDelay === undefined ? 0 : parseInt(a.effectiveDelay)
			delete a.effectiveDelay

			this.debug('Running action', a)

			if (this.instance.isInstanceEnabled(a.instance)) {
				// is this a timedelayed action?
				if (delay > 0) {
					hasDelayed = true
					;((action, delayTime) => {
						let timer = setTimeout(() => {
							this.runAction(action, { deviceid: deviceid, page: page, bank: bank })

							this.timersRunning.delete(timer)

							// Stop timer-indication
							const hasAnotherTimer = Array.from(this.timersRunning.values()).find((v) => v === bankId)
							if (hasAnotherTimer === undefined) {
								this.actionsRunning.delete(bankId)
								this.system.emit('graphics_bank_invalidate', page, bank)
							}
						}, delayTime)

						this.timersRunning.push(timer)
					})(a, delay)
				}

				// or is it immediate
				else {
					this.runAction(a, { deviceid: deviceid, page: page, bank: bank })
				}
			} else {
				this.debug('not running action for disabled instance')
			}
		}

		if (hasDelayed) {
			// Start timer-indication
			this.actionsRunning.add(bankId)

			this.graphics.invalidateBank(page, bank)
		}
	}

	checkBanks(pageBankArray) {
		if (pageBankArray.length > 0) {
			for (let s in pageBankArray) {
				let bp = s.split('_')
				this.checkBankStatus(bp[0], bp[1])
			}
		}
	}

	checkBankStatus(page, bank, invalidate = true) {
		let status = 0

		status = this.actions.checkBankStatus(page, bank, status)
		status = this.releaseActions.checkBankStatus(page, bank, status)

		if (status != this.bankStatus[page + '_' + bank]) {
			this.bankStatus[page + '_' + bank] = status

			if (invalidate === true) {
				this.graphics.invalidateBank(page, bank)
			}
		}
	}

	checkInstanceStatus(instance, level, msg) {
		let checkQueue = []
		checkQueue = this.actions.checkInstanceStatus(instance, checkQueue)
		checkQueue = this.releaseActions.checkInstanceStatus(instance, checkQueue)

		this.checkBanks(checkQueue)
	}

	clientConnect(client) {
		client.on('get_actions', () => {
			client.emit('get_actions:result', this.getUiDefinitions())
		})

		client.on('bank_update_action_delay', this.actions.updateItemDelay.bind(this.actions))
		client.on('bank_update_action_option', this.actions.updateItemOption.bind(this.actions))
		client.on('bank_update_action_option_order', this.actions.updateItemOrder.bind(this.actions))

		client.on('bank_action_add', this.actions.addItemByClient.bind(this.actions))
		client.on('bank_action_delete', this.actions.deleteItemByClient.bind(this.actions))
		client.on('bank_actions_get', this.actions.getBankByClient.bind(this.actions))

		client.on('bank_update_release_action_delay', this.releaseActions.updateItemDelay.bind(this.releaseActions))
		client.on('bank_release_action_update_option', this.releaseActions.updateItemOption.bind(this.releaseActions))
		client.on('bank_release_action_update_option_order', this.releaseActions.updateItemOrder.bind(this.releaseActions))

		client.on('bank_addReleaseAction', this.releaseActions.addItemByClient.bind(this.releaseActions))
		client.on('bank_release_action_delete', this.releaseActions.deleteItemByClient.bind(this.releaseActions))
		client.on('bank_release_actions_get', this.releaseActions.getBankByClient.bind(this.releaseActions))
	}

	deleteInstance(id) {
		delete this.definitions[id]

		this.updateDefinitions()

		let checkQueue = []
		checkQueue = this.actions.deleteInstance(id, checkQueue)
		checkQueue = this.releaseActions.deleteInstance(id, checkQueue)

		this.checkBanks(checkQueue)
	}

	getActions(clone = false) {
		return this.actions.getAll(clone)
	}

	getBankActions(page, bank, clone = false) {
		return this.actions.getBank(page, bank, clone)
	}

	getBankStatus(page, bank) {
		return this.bankStatus[page + '_' + bank]
	}

	getBankReleaseActions(page, bank, clone = false) {
		return this.releaseActions.getBank(page, bank, clone)
	}

	getInstanceActions(instanceId) {
		return this.actions.getInstanceItems(instanceId)
	}

	getInstanceReleaseActions(instanceId) {
		return this.releaseActions.getInstanceItems(instanceId)
	}

	getReleaseActions(clone = false) {
		return this.releaseActions.getAll(clone)
	}

	getRunningActions(page, bank) {
		return this.actionsRunning.has(`${page}_${bank}`)
	}

	getUiDefinitions() {
		//for UI backwards compatibility
		let out = []

		for (let n in this.definitions) {
			let a = this.definitions[n]
			out[id + ':' + n] = a
		}

		return out
	}

	importBank(page, bank, actions, releaseActions) {
		this.actions.importBank(page, bank, actions)
		this.releaseActions.importBank(page, bank, releaseActions)
		this.checkBankStatus(page, bank, false)
	}

	resetBank(page, bank) {
		this.actions.resetBank(page, bank)
		this.releaseActions.resetBank(page, bank)
	}

	runAction(action, extras) {
		if (action !== undefiend && action.instance !== undefined && this.definitions[action.instance]) {
			let instance = this.instance.getInstance(action.instance)

			if (instance !== undefined) {
				const definition = this.definitions[action.instance][action.type]
				action.action = action.type // backwards compatibility

				try {
					// Ask instance to execute action
					if (
						definition !== undefined &&
						definition.callback !== undefined &&
						typeof definition.callback == 'function'
					) {
						definition.callback(action, extras)
					} else if (typeof instance.action == 'function') {
						instance.action(action, extras)
					} else {
						this.debug('ERROR: instance does not have an action() function:', instance)
					}
				} catch (e) {
					this.registry.log.add('instance(' + instance.label + ')', 'warn', 'Error executing action: ' + e.message)
				}
			}
		}
	}

	saveActions() {
		this.actions.save()
	}

	saveReleaseActions() {
		this.releaseActions.save()
	}

	setInstanceDefinitions(id, actions) {
		this.definitions[id] = actions
		this.updateDefinitions()
	}

	subscribeBank(page, bank) {
		this.actions.subscribeBank(page, bank)
		this.releaseActions.subscribeBank(page, bank)
	}

	unsubscribeBank(page, bank) {
		this.actions.unsubscribeBank(page, bank)
		this.releaseActions.unsubscribeBank(page, bank)
	}

	updateDefinitions() {
		this.actions.setDefinitions(this.definitions)
		this.releaseActions.setDefinitions(this.definitions)
		this.debug('actions_update:', this.definitions)
		this.io.emit('actions', this.getUiDefinitions())
	}
}

exports = module.exports = BankActionController

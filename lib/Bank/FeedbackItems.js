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

const BankItemsBase = require('./ItemsBase')
const { isEqual, cloneDeep } = require('lodash')

/**
 * Class used by the feedback controller to manage the feedback items
 *
 * @extends BankItemsBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
class BankFeedbackItems extends BankItemsBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Bank/FeedbackItems')

	/**
	 * @param {Registry} registry - the core registry
	 * @param {(BankActionController|BankFeedbackController)} controller - the item's parent controller
	 * @param {string} logSource - module name to be used in logs
	 * @param {string} dbKey - the key to fetch from the database
	 */
	constructor(registry, controller, logSource, dbKey) {
		super(registry, controller, logSource, dbKey)
		this.styles = {}
	}

	/**
	 * Scrub a bank's feedback items to process the current status/style
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 */
	checkBankStatus(page, bank) {
		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i = 0; i < this.items[page][bank].length; ++i) {
				this.checkStatus(page, bank, i)
			}
		}
	}

	/**
	 * Check an item's status and update its style
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} index - the item's index
	 */
	checkStatus(page, bank, index) {
		let result

		if (
			this.items[page] !== undefined &&
			this.items[page][bank] !== undefined &&
			this.items[page][bank][index] !== undefined
		) {
			let item = this.items[page][bank][index]
			let instance = this.instance.getInstance(item.instance)
			let bankObj = this.bank.getBank(page, bank)

			if (instance !== undefined && bankObj !== undefined) {
				let definition
				item.instance_id = item.instance // backwards compatibility

				if (this.definitions[instance.id] !== undefined && this.definitions[instance.id][item.type] !== undefined) {
					definition = this.definitions[instance.id][item.type]
				}

				try {
					// Ask instance to check bank for custom styling
					if (
						definition !== undefined &&
						definition.callback !== undefined &&
						typeof definition.callback == 'function'
					) {
						result = definition.callback(item, bankObj, { page: page, bank: bank })
						this.setStyle(page, bank, index, result)
					} else if (typeof instance.feedback == 'function') {
						result = instance.feedback(item, bankObj, { page: page, bank: bank })
						this.setStyle(page, bank, index, result)
					} else {
						this.debug('ERROR: instance ' + instance.label + ' does not have a feedback() function')
					}
				} catch (e) {
					this.system.emit('log', 'instance(' + instance.label + ')', 'warn', 'Error checking feedback: ' + e.message)
				}
			}
		}

		return result
	}

	/**
	 * Delete an item
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} index - the item's index
	 * @access public
	 */
	deleteItem(page, bank, index) {
		super.deleteItem(page, bank, index)

		if (
			this.styles[page] !== undefined &&
			this.styles[page][bank] !== undefined &&
			this.styles[page][bank][index] !== undefined
		) {
			this.styles[page][bank].splice(index, 1)
		}

		this.controller.checkBankStyle(page, bank)
	}

	/**
	 * Get the items in a bank via a client socket
	 * @param {IO.Socket} client - the client socket sending the request
	 * @param {string} result - the name of the call to send the results back to the client
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access public
	 */
	getBankByClient(client, result, page, bank) {
		let items = this.getBank(page, bank)

		for (let item in items) {
			// Backwards compatibility
			items[item].instance_id = items[item].instance
		}

		client.emit(result, page, bank, items)
	}

	/**
	 * Get the current style for a bank's items
	 * @param {number} page - the item's page
	 * @param {number} bank - the item bank
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {BankStyle[]} the bank array
	 * @access public
	 */
	getBankStyles(page, bank, clone = false) {
		let out

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.styles[page][bank])
			} else {
				out = this.styles[page][bank]
			}
		}

		return out
	}

	/**
	 * Get all the items for a specific instance
	 * @param {string} id - the instance id
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object} the items array
	 * @access public
	 */
	getInstanceItems(id, clone = false) {
		let items = super.getInstanceItems(id, clone)

		for (let item in items) {
			// Backwards compatibility
			items[item].instance_id = items[item].instance
		}

		return items
	}

	/**
	 * Get the current style for an item
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} index - the item's index
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {BankStyle} the items array
	 * @access public
	 */
	getStyle(page, bank, index, clone = false) {
		let out

		if (
			this.styles[page] !== undefined &&
			this.styles[page][bank] !== undefined &&
			this.styles[page][bank][index] !== undefined
		) {
			if (clone === true) {
				out = cloneDeep(this.styles[page][bank][index])
			} else {
				out = this.styles[page][bank][index]
			}
		}

		return out
	}

	/**
	 * Unsubscribe, clear a bank, and save
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access public
	 */
	resetBank(page, bank) {
		super.resetBank(page, bank)

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined) {
			this.styles[page][bank] = []
		}
	}

	/**
	 * Save the current return style from a feedback
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} index - the item's index
	 * @param {BankStyle} style - the current style
	 * @access protected
	 */
	setStyle(page, bank, index, style) {
		if (this.styles[page] === undefined) {
			this.styles[page] = {}
		}

		if (this.styles[page][bank] === undefined) {
			this.styles[page][bank] = []
		}

		if (!isEqual(style, this.styles[page][bank][index])) {
			this.debug('Feedback changed style of bank ' + page + '.' + bank)
			this.styles[page][bank][index] = style
		}
	}

	/**
	 * Update an option for an item, subscribe, and save
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {string} item - the item's id (`item.id`)
	 * @param {string} option - the option id/key
	 * @param {(string|string[]|number|boolean)} value - the new value
	 * @access public
	 */
	updateItemOption(page, bank, item, option, value) {
		super.updateItemOption(page, bank, item, option, value)

		let bp = this.getBank(page, bank)

		if (bp !== undefined) {
			for (let n in bp) {
				if (bp[n] !== undefined && bp[n].id === item) {
					this.checkStatus(page, bank, n)
					break
				}
			}
		}

		this.controller.checkBankStyle(page, bank)
	}

	/**
	 * Update a bank item order by swapping two keys
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {number} oldIndex - the moving item's index
	 * @param {number} newIndex - the other index to swap with
	 * @access public
	 */
	updateItemOrder(page, bank, oldIndex, newIndex) {
		super.updateItemOrder(page, bank, oldIndex, newIndex)

		this.controller.checkBankStyle(page, bank)
	}
}

exports = module.exports = BankFeedbackItems

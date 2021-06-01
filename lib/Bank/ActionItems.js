const BankItemsBase = require('./ItemsBase')

/**
 * Class used by the action controller to manage either action or release action items
 *
 * @extends BankItemsBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
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
class BankActionItems extends BankItemsBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Bank/ActionItems')

	/**
	 * @param {Registry} registry - the core registry
	 * @param {(BankActionController|BankFeedbackController)} controller - the item's parent controller
	 * @param {string} logSource - module name to be used in logs
	 * @param {string} dbKey - the key to fetch from the database
	 */
	constructor(registry, controller, logSource, dbKey) {
		super(registry, controller, logSource, dbKey)
	}

	/**
	 * Check all the actions' instances for their status number and report the highest
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {number} status - incoming value to update if the value checked is higher
	 * @returns {number} the final status
	 */
	checkBankStatus(page, bank, status) {
		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			for (let i = 0; i < this.items[page][bank].length; ++i) {
				let item = this.items[page][bank][i]
				let instanceStatus = this.instance.getInstanceStatus(item.instance)

				if (instanceStatus !== undefined && status < instanceStatus[0]) {
					status = instanceStatus[0]
				}
			}
		}

		return status
	}

	/**
	 * Get the items in a bank via a client socket
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {function} answer - UI callback
	 */
	getBankByClient(page, bank, answer) {
		let items = this.getBank(page, bank)

		for (let item in items) {
			// Backwards compatibility
			items[item].action = items[item].type
		}

		answer(page, bank, items)
	}

	/**
	 * Get all the items for a specific instance
	 * @param {string} id - the instance id
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object} the items array
	 */
	getInstanceItems(id, clone = false) {
		let items = super.getInstanceItems(id, clone)

		for (let item in items) {
			// Backwards compatibility
			items[item].action = items[item].type
		}

		return items
	}

	/**
	 * Update the delay for an item and save
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {string} item - the item's id (`item.id`)
	 * @param {number} value - the new delay value
	 */
	updateItemDelay(page, bank, item, value) {
		let bp = this.items[page][bank]

		if (bp !== undefined) {
			for (let n in bp) {
				let obj = bp[n]
				if (obj !== undefined && obj.id === item) {
					this.items[page][bank][n].delay = value
					this.save()
				}
			}
		}
	}
}

exports = module.exports = BankActionItems

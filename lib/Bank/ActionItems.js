/**
 * This file is part of the Companion project
 * Copyright (c) 2021 Bitfocus AS
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

const debug         = require('debug')('lib/Bank/FeedbackItem');
const BankItemsBase = require('./ItemsBase');

/**
 * Class used by the action controller to manage either action or release action items
 * @extends BankItemBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class BankActionItems extends BankItemsBase {

	constructor(registry, controller, logSource, dbKey) {
		super(registry, controller, logSource, dbKey);
		this.debug = debug;
	}

	checkBankStatus(page, bank, status) {

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			for (let i = 0; i < this.items[page][bank].length ; ++i) {
				let item = this.items[page][bank][i];
				let instanceStatus = this.instance().getInstanceStatus(item.instance);

				if (instanceStatus !== undefined && status < instanceStatus[0]) {
					status = instanceStatus[0];
				}
			}
		}

		return status;
	}

	/**
	 * Get the items in a bank via a client socket
	 * @param {IO.Socket} client - the client socket sending the request
	 * @param {string} result - the name of the call to send the results back to the client
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank numbers
	 */
	getBankByClient(client, result, page, bank) {
		let items = this.getBank(page, bank);
		
		for (let item in items) { // Backwards compatibility
			items[item].action = items[item].type;
		}

		client.emit(result, page, bank, items);
	}

	/**
	 * Get all the items for a specific instance
	 * @param {string} id - the instance id
	 * @param {boolean} clone - whether or not the return should be a deep clone
	 * @returns {Object} the items array
	 */
	getInstanceItems(id, clone = false) {
		let items = super.getInstanceItems(id, clone);

		for (let item in items) { // Backwards compatibility
			items[item].action = items[item].type;
		}

		return items;
	}

	/**
	 * Update the delay for an item and save
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {string} item - the item's id (`item.id`)
	 * @param {number} value - the new delay value
	 */
	updateItemDelay(page, bank, item, value) {
		let bp = this.items[page][bank];

		if (bp !== undefined) {
			for (let n in bp) {
				let obj = bp[n];
				if (obj !== undefined && obj.id === item) {
					this.items[page][bank][n].delay = value;
					this.save();
				}
			}
		}
	}
}

exports = module.exports = BankActionItems;
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

const debug         = require('debug')('lib/Bank/FeedbackItem');
const BankItemsBase = require('./ItemsBase');
const { isEqual, cloneDeep }  = require('lodash');

// Imports for JSDoc


/**
 * Class used by the feedback controller to manage the feedback items
 * @extends BankItemBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class BankFeedbackItems extends BankItemsBase {

	constructor(registry, controller, logSource, dbKey) {
		super(registry, controller, logSource, dbKey);
		this.debug = debug;
		this.styles = {};
	}

	checkBankStatus(page, bank) {

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i = 0; i < this.items[page][bank].length; ++i) {
				this.checkStatus(page, bank, i);
			}
		}
	}

	checkStatus(page, bank, i) {
		let result;

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined && this.items[page][bank][i] !== undefined) {
			let item = this.items[page][bank][i];
			let instance = this.instance().getInstance(item.instance);
			let bankObj = this.bank().getBank(page, bank);

			if (instance !== undefined && bankObj !== undefined) {
				let definition;
				item.instance_id = item.instance; // backwards compatibility

				if (this.definitions[instance.id] !== undefined && this.definitions[instance.id][item.type] !== undefined) {
					definition = this.definitions[instance.id][item.type];
				}

				try {
					// Ask instance to check bank for custom styling
					if (definition !== undefined && definition.callback !== undefined && typeof definition.callback == 'function') {
						result = definition.callback(item, bankObj);
						this.setStyle(page, bank, i, result);
					} else if (typeof instance.feedback == 'function') {
						result = instance.feedback(item, bankObj);
						this.setStyle(page, bank, i, result);
					} else {
						this.debug('ERROR: instance ' + instance.label + ' does not have a feedback() function');
					}
				}
				catch(e) {
					this.system.emit('log', 'instance('+instance.label+')', 'warn', 'Error checking feedback: ' + e.message);
				}
			}
		}

		return result;
	}

	deleteItem(page, bank, index) {
		super.deleteItem(page, bank, index);

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined && this.styles[page][bank][index] !== undefined) {
			this.styles[page][bank].splice(index, 1);
		}

		this.controller.checkBankStyle(page, bank);
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
			items[item].instance_id = items[item].instance;
		}

		client.emit(result, page, bank, items);
	}

	getBankStyles(page, bank, clone = false) {
		let out;

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.styles[page][bank]);
			}
			else {
				out = this.styles[page][bank];
			}
		}

		return out;
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
			items[item].instance_id = items[item].instance;
		}

		return items;
	}

	getStyle(page, bank, index, clone = false) {
		let out;

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined && this.styles[page][bank][index] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.styles[page][bank][index]);
			}
			else {
				out = this.styles[page][bank][index];
			}
		}

		return out;
	}

	resetBank(page, bank) {
		super.resetBank(page, bank);

		if (this.styles[page] !== undefined && this.styles[page][bank] !== undefined) {
			this.styles[page][bank] = [];
		}
	}

	setStyle(page, bank, index, style) {

		if (this.styles[page] === undefined) {
			this.styles[page] = {};
		}

		if (this.styles[page][bank] === undefined) {
			this.styles[page][bank] = [];
		}

		if (!isEqual(style, this.styles[page][bank][index])) {
			this.debug('Feedback changed style of bank ' + page + '.' + bank);
			this.styles[page][bank][index] = style;
		}
	}

	updateItemOption(page, bank, item, option, value) {
		super.updateItemOption(page, bank, item, option, value);

		let bp = this.getBank(page, bank);

		if (bp !== undefined) {
			for (let n in bp) {
				if (bp[n] !== undefined && bp[n].id === item) {
					this.checkStatus(page, bank, n);
					break;
				}
			}
		}

		this.controller.checkBankStyle(page, bank);
	}

	updateItemOrder(page, bank, oldIndex, newIndex) {
		super.updateItemOrder(page, bank, oldIndex, newIndex);

		this.controller.checkBankStyle(page, bank);
	}
}

exports = module.exports = BankFeedbackItems;
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

const BankItemBase = require('./ItemBase');

class BankFeedbackItem extends BankItemBase {

	checkBankStatus(page, bank, status) {

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			for (var i = 0; i < this.items[page][bank].length ; ++i) {
				var item = this.items[page][bank][i];
				var instanceStatus = this.instance().getInstanceStatus(item.instance);

				if (instanceStatus !== undefined && status < instanceStatus[0]) {
					status = instanceStatus[0];
				}
			}
		}

		return status;
	}

	// Backwards compatibility
	getBankByClient(client, result, page, bank) {
		let items = this.getBank(page, bank);
		
		for (let item in items) {
			items[item].instance_id = items[item].instance;
		}

		client.emit(result, page, bank, items);
	}

	// Backwards compatibility
	getInstanceItems(id) {
		let items = super.getInstanceItems(id);

		for (let item in items) {
			items[item].instance_id = items[item].instance;
		}

		return items;
	}
}

exports = module.exports = BankFeedbackItem;
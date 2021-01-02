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

class BankActionItem extends BankItemBase {

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

	getBankByClient(client, result, page, bank) {
		let items = this.getBank(page, bank);
		
		for (let item in items) { // Backwards compatibility
			items[item].action = items[item].type;
		}

		client.emit(result, page, bank, items);
	}

	getInstanceItems(id) {
		let items = super.getInstanceItems(id);

		for (let item in items) { // Backwards compatibility
			items[item].action = items[item].type;
		}

		return items;
	}

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

exports = module.exports = BankActionItem;
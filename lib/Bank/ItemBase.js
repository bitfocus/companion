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

const CoreBase      = require('../Core/Base');
const shortid       = require('shortid');
const { cloneDeep } = require('lodash');

class BankItemBase extends CoreBase {

	constructor(registry, controller, logSource, dbKey) {
		super(registry, logSource);
		this.controller = controller;
		this.dbKey      = dbKey;

		this.definitions = {};
		this.items       = this.db().getKey(this.dbKey, {});
	}

	addItem(page, bank, item) {
		this.checkBankExists(page, bank);
		const s = item.split(/:/);

		let newItem = {
			'id': shortid.generate(),
			'label': item,
			'type': s[1],
			'instance': s[0],
			'options': {}
		};

		if (this.definitions[s[0]] !== undefined && this.definitions[s[0]][s[1]] !== undefined) {
			let definition = this.definitions[s[0]][s[1]];

			if (definition.options !== undefined && definition.options.length > 0) {
				for(let j in definition.options) {
					let opt = definition.options[j];
					newItem.options[opt.id] = opt.default;
				}
			}
		}

		this.items[page][bank].push(newItem);
		this.subscribeItem(newItem);
	}

	addItemByClient(client, result, page, bank, item) {
		this.addItem(page, bank, item)

		this.save();
		client.emit(result, page, bank, this.items[page][bank] );
		this.bank().checkBankStatus(page, bank);
	}

	bank() {
		return this.registry.bank;
	}

	checkBankExists(page, bank) {
		
		if (this.items[page] === undefined) {
			this.items[page] = {};
		}

		if (this.items[page][bank] === undefined) {
			this.items[page][bank] = [];
		}
	}

	checkInstanceStatus(id, type, checkQueue = []) {

		for (let page in this.items) {
			if (this.items[page] !== undefined) {
				for (let bank in this.items[page]) {
					if (this.items[page][bank] !== undefined) {
						for (let i = 0; i < this.items[page][bank].length; ++i) {
							let item = this.items[page][bank][i];
							if (item.instance == id && (type === undefined || item.type == type)) {
								checkQueue[page + '_' + bank] = true;
								this.checkStatus(page, bank, i);
							}
						}
					}
				}
			}
		}

		return checkQueue;
	}

	checkStatus(page, bank, i) {}

	deleteInstance(id, checkQueue = []) {

		for (let page in this.items) {
			for (let bank in this.items[page]) {
				if (this.items[page][bank] !== undefined) {
					for (let i = 0; i < this.items[page][bank].length ; ++i) {
						let item = this.items[page][bank][i];

						if (item.instance == id) {
							this.debug('Deleting item ' + i + ' from button ' + page + '.' + bank);
							this.deleteItem(page, bank. i);
							checkQueue[page + '_' + bank] = true;
							i--;
						}
					}
				}
			}
		}

		this.save();

		return checkQueue;
	}

	deleteItem(page, bank, index) {

		if(this.items[page] !== undefined && this.items[page][bank] !== undefined && this.items[page][bank][index]!== undefined) {
			this.unsubscribeItem(this.items[page][bank][index]);
			this.items[page][bank].splice(index, 1);
		}
	}

	deleteItemByClient(client, result, page, bank, id) {
		let ba = this.items[page][bank];

		for (let n in ba) {
			if (ba[n].id == id) {
				this.deleteItem(page, bank, index);
				break;
			}
		}

		this.save();
		client.emit(result, page, bank, this.items[page][bank] );
		this.bank().checkBankStatus(page, bank);
	}

	getAll(clone = false) {
		let out;

		if (this.items !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.items);
			}
			else {
				out = this.items;
			}
		}

		return out;
	}

	getBank(page, bank, clone = false) {
		this.checkBankExists(page, bank);
		let out;

		if (clone === true) {
			out = cloneDeep(this.items[page][bank]);
		}
		else {
			out = this.items[page][bank];
		}

		return out;
	}

	getBankByClient(client, result, page, bank) {
		client.emit(result, page, bank, this.getBank(page, bank));
	}

	getInstanceItems(instanceId, clone = false) {
		let out = [];

		for (let page in this.items) {
			for (let bank in this.items[page]) {
				for (let i in this.items[page][bank]) {
					let item = this.items[page][bank][i];
					if (item.instance == instanceId) {
						out.push(item);
					}
				}
			}
		}

		if (clone === true) {
			out = cloneDeep(out);
		}

		return out;
	}

	getPage(page, clone = false) {
		let out;

		if (this.items[page] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.items[page]);
			}
			else {
				out = this.items[page];
			}
		}

		return out;
	}

	resetBank(page, bank) {
		this.unsubscribeBank(page, bank);

		if (this.items[page] === undefined) {
			this.items[page] = {};
		}
		this.items[page][bank] = [];

		this.save();
	}

	save() {
		//this.db().setKey(this.dbKey, this.items);
		this.db().setDirty();
		this.debug('saving');
	}

	setDefinitions(definitions) {
		this.definitions = definitions;
	}

	subscribe(item) {

		if (item.type !== undefined && item.instance !== undefined) {
			if (this.definitions[item.instance] !== undefined && this.definitions[item.instance][item.type] !== undefined) {
				let definition = this.definitions[item.instance][item.type];
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(item);
				}
			}
		}
	}

	subscribeBank(page, bank) {

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i in this.items[page][bank]) {
				this.subscribe(this.items[page][bank][i]);
			}
		}
	}

	unsubscribe(item) {

		if (item.type !== undefined && item.instance !== undefined) {
			if (this.definitions[item.instance] !== undefined && this.definitions[item.instance][item.type] !== undefined) {
				let definition = this.definitions[item.instance][item.type];
				// Run the subscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(item);
				}
			}
		}
	}

	unsubscribeBank(page, bank) {

		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i in this.items[page][bank]) {
				this.unsubscribe(this.items[page][bank][i]);
			}
		}
	}

	updateItemOption(page, bank, item, option, value) {
		this.debug('bank_update_item_option', page, bank, item, option, value);
		let bp = this.getBank(page, bank);

		if (bp !== undefined) {
			for (let n in bp) {
				let obj = bp[n];
				if (obj !== undefined && obj.id === item) {
					this.unsubscribeItem(obj);
					if (obj.options === undefined) {
						obj.options = {};
					}
					obj.options[option] = value;
					this.subscribeItem(obj);
					this.save();
				}
			}
		}
	}

	updateItemOrder(page, bank, oldIndex, newIndex) {
		let bp = this.getBank(page, bank);

		if (bp !== undefined) {
			bp.splice(newIndex, 0, bp.splice(oldIndex, 1)[0]);
			this.save();
		}
	}
}

exports = module.exports = BankItemBase;
/*
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

const CoreBase = require('../Core/Base')
const shortid = require('shortid')
const { cloneDeep } = require('lodash')

/**
 * Abstract class to be extended and used by bank controllers to track their items.
 * See {@link BankActionItems} and {@link BankFeedbackItems}
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @abstract
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
class BankItemsBase extends CoreBase {
	/**
	 * The parent controller
	 * @type {(BankActionController|BankFeedbackController)}
	 * @access protected
	 */
	controller = null
	/**
	 * The database to use load/save the items
	 * @type {string}
	 * @access protected
	 */
	dbKey = null
	/**
	 * Nested arrays for the definitions from the instances: <code>[instance_id][item_id]</code>
	 * @type {Object.<string,BankItemDefinition[]>}
	 * @access protected
	 */
	definitions = {}
	/**
	 * Nested arrays containing the items in the banks: <code>[page][bank][item]</code>
	 * Also is the data that is stored to the DB.
	 * @type {Object.<number,Array.<number,Object.<number,BankItem>>>}
	 * @access protected
	 */
	items = null

	/**
	 * @param {Registry} registry - the core registry
	 * @param {(BankActionController|BankFeedbackController)} controller - the item's parent controller
	 * @param {string} logSource - module name to be used in logs
	 * @param {string} dbKey - the key to fetch from the database
	 */
	constructor(registry, controller, logSource, dbKey) {
		super(registry, logSource)
		this.controller = controller
		this.dbKey = dbKey

		this.items = this.db.getKey(this.dbKey, {})
		//this.cleanupItems()
	}

	/**
	 * Add an item to a bank
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {string} item - item information in form: `"instance_id:type"`
	 * @access public
	 */
	addItem(page, bank, item) {
		this.checkBankExists(page, bank)
		const s = item.split(/:/)

		let newItem = {
			id: shortid.generate(),
			label: item,
			type: s[1],
			instance: s[0],
			options: {},
		}

		if (!this.instance.getInstanceConfig(newItem.instance)) {
			// Item is not valid
			return
		}

		if (this.definitions[s[0]] !== undefined && this.definitions[s[0]][s[1]] !== undefined) {
			let definition = this.definitions[s[0]][s[1]]

			if (definition.options !== undefined && definition.options.length > 0) {
				for (let j in definition.options) {
					let opt = definition.options[j]
					newItem.options[opt.id] = opt.default
				}
			}
		}

		this.items[page][bank].push(newItem)
		this.subscribeItem(newItem)
	}

	/**
	 * Add item to a bank via a client socket
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {string} item - item information in form: `"instance_id:type"`
	 * @param {function} answer - UI callback
	 * @access public
	 */
	addItemByClient(page, bank, item, answer) {
		this.addItem(page, bank, item)

		this.save()
		answer(page, bank, this.items[page][bank])
		this.bank.checkBankStatus(page, bank)
	}

	/**
	 * Check if a bank exists and initialize it if it doesn't
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access protected
	 */
	checkBankExists(page, bank) {
		if (this.items[page] === undefined) {
			this.items[page] = {}
		}

		if (this.items[page][bank] === undefined) {
			this.items[page][bank] = []
		}
	}

	/**
	 * Scan the page/bank array to find items for an instance or just specific types and populate an array with the findings
	 * @param {string} id - the instance ID to check for
	 * @param {string} type - the item type to check for
	 * @param {?Array.<string,boolean>} checkQueue - array of flagged banks with keys of `[page_bank]`; empty by default but can have a populated version passed to be added to
	 * @returns {Array.<string,boolean>} the populated `checkQueue`
	 * @access public
	 */
	checkInstanceStatus(id, type, checkQueue = []) {
		for (let page in this.items) {
			if (this.items[page] !== undefined) {
				for (let bank in this.items[page]) {
					if (this.items[page][bank] !== undefined) {
						for (let i = 0; i < this.items[page][bank].length; ++i) {
							let item = this.items[page][bank][i]
							if (item.instance == id && (type === undefined || item.type == type)) {
								checkQueue[page + '_' + bank] = true
								this.checkStatus(page, bank, i)
							}
						}
					}
				}
			}
		}

		return checkQueue
	}

	/**
	 * Check an item's status
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} i - the item's index
	 * @access protected
	 */
	checkStatus(page, bank, i) {}

	/**
	 * Checks all the items to ensure their instances still exist
	 * @access protected
	 */
	cleanupItems() {
		const res = {}

		for (var page in this.items) {
			res[page] = {}
			for (var bank in this.items[page]) {
				res[page][bank] = []

				if (this.items[page][bank] !== undefined) {
					for (var i = 0; i < this.items[page][bank].length; ++i) {
						const item = this.items[page][bank][i]
						if (item && this.instance.getInstanceConfig(item.instance)) {
							res[page][bank].push(item)
						}
					}
				}
			}
		}

		this.items = res
		this.db.setKey(this.dbKey, this.items)
	}

	/**
	 * Scan the page/bank array for items from an instance and delete them
	 * @param {string} id - the instance ID to delete
	 * @param {?Array.<string,boolean>} checkQueue - array of changed banks with keys of `[page_bank]`; empty by default but can have a populated version passed to be added to
	 * @returns {Array.<string,boolean>} the populated `checkQueue`
	 * @access public
	 */
	deleteInstance(id, checkQueue = []) {
		for (let page in this.items) {
			for (let bank in this.items[page]) {
				if (this.items[page][bank] !== undefined) {
					for (let i = 0; i < this.items[page][bank].length; ++i) {
						let item = this.items[page][bank][i]

						if (item.instance == id) {
							this.debug('Deleting item ' + i + ' from button ' + page + '.' + bank)
							this.deleteItem(page, bank.i)
							checkQueue[page + '_' + bank] = true
							i--
						}
					}
				}
			}
		}

		this.save()

		return checkQueue
	}

	/**
	 * Delete an item
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {number} index - the item's index
	 * @access public
	 */
	deleteItem(page, bank, index) {
		if (
			this.items[page] !== undefined &&
			this.items[page][bank] !== undefined &&
			this.items[page][bank][index] !== undefined
		) {
			this.unsubscribeItem(this.items[page][bank][index])
			this.items[page][bank].splice(index, 1)
		}
	}

	/**
	 * Delete an item from a bank via a client socket
	 * @param {number} page - the item's page
	 * @param {number} bank - the item's bank
	 * @param {string} index - the item's id (`item.id`)
	 * @param {function} answer - UI callback
	 * @access public
	 */
	deleteItemByClient(page, bank, id, answer) {
		let ba = this.items[page][bank]

		for (let n in ba) {
			if (ba[n].id == id) {
				this.deleteItem(page, bank, index)
				break
			}
		}

		this.save()
		answer(page, bank, this.items[page][bank])
		this.bank.checkBankStatus(page, bank)
	}

	/**
	 * Get the entire items array
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object} the array in the form `[page][bank][item]`
	 * @access public
	 */
	getAll(clone = false) {
		let out

		if (this.items !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.items)

				// cleanup old keys
				for (let p in out) {
					for (let b in out[p]) {
						for (let i in out[p][b]) {
							if (out[p][b][i].action !== undefined && out[p][b][i].type !== undefined) {
								delete out[p][b][i].action
							}

							if (out[p][b][i].instance_id !== undefined && out[p][b][i].instance !== undefined) {
								delete out[p][b][i].instance_id
							}
						}
					}
				}
			} else {
				out = this.items
			}
		}

		return out
	}

	/**
	 * Get the items in a bank
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {BankItem[]} the items array
	 * @access public
	 */
	getBank(page, bank, clone = false) {
		this.checkBankExists(page, bank)
		let out

		if (clone === true) {
			out = cloneDeep(this.items[page][bank])

			// cleanup old keys
			for (let i in out) {
				if (out[i].action !== undefined && out[i].type !== undefined) {
					delete out[i].action
				}

				if (out[i].instance_id !== undefined && out[i].instance !== undefined) {
					delete out[i].instance_id
				}
			}
		} else {
			out = this.items[page][bank]
		}

		return out
	}

	/**
	 * Get the items in a bank via a client socket
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {function} answer - UI callback
	 * @access public
	 */
	getBankByClient(page, bank, answer) {
		answer(page, bank, this.getBank(page, bank))
	}

	/**
	 * Get all the items for a specific instance
	 * @param {string} id - the instance id
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {BankItem[]} the items array
	 * @access public
	 */
	getInstanceItems(id, clone = false) {
		let out = []

		for (let page in this.items) {
			for (let bank in this.items[page]) {
				for (let i in this.items[page][bank]) {
					let item = this.items[page][bank][i]
					if (item.instance == id) {
						out.push(item)
					}
				}
			}
		}

		if (clone === true) {
			out = cloneDeep(out)
		}

		return out
	}

	/**
	 * Get the items on a page
	 * @param {number} page - the page number
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Array.<number,Array.<BankItem>>} the array in the form `[bank][item]`
	 * @access public
	 */
	getPage(page, clone = false) {
		let out

		if (this.items[page] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.items[page])

				// cleanup old keys
				for (let b in out) {
					for (let i in out[b]) {
						if (out[b][i].action !== undefined && out[b][i].type !== undefined) {
							delete out[b][i].action
						}

						if (out[b][i].instance_id !== undefined && out[b][i].instance !== undefined) {
							delete out[b][i].instance_id
						}
					}
				}
			} else {
				out = this.items[page]
			}
		}

		return out
	}

	/**
	 * Import and subscribe items to a bank
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @param {BankItem[]} items - the items to import
	 * @access public
	 */
	importBank(page, bank, items) {
		if (items !== undefined) {
			if (this.items[page] === undefined) {
				this.items[page] = {}
			}

			if (this.items[page][bank] === undefined) {
				this.items[page][bank] = []
			}

			for (let i = 0; i < items.length; ++i) {
				let obj = items[i]
				obj.id = shortid.generate()
				this.items[page][bank].push(obj)
			}

			this.subscribeBank(page, bank)
		}
	}

	/**
	 * Unsubscribe, clear a bank, and save
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access public
	 */
	resetBank(page, bank) {
		this.unsubscribeBank(page, bank)

		if (this.items[page] === undefined) {
			this.items[page] = {}
		}
		this.items[page][bank] = []

		this.save()
	}

	/**
	 * Flag the database to save
	 * @access public
	 */
	save() {
		//this.db.setKey(this.dbKey, this.items);
		this.db.setDirty()
		this.debug('saving')
	}

	/**
	 * Set a new definitions array
	 * @param {BankItemDefinition[]} definitions - the new definitions
	 * @access public
	 */
	setDefinitions(definitions) {
		this.definitions = definitions
	}

	/**
	 * Find a subscribe function for an item and execute it
	 * @param {BankItem} item - the item object
	 * @access protected
	 */
	subscribe(item) {
		if (item.type !== undefined && item.instance !== undefined) {
			if (this.definitions[item.instance] !== undefined && this.definitions[item.instance][item.type] !== undefined) {
				let definition = this.definitions[item.instance][item.type]
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(item)
				}
			}
		}
	}

	/**
	 * Execute subscribes for all the items in a bank
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access public
	 */
	subscribeBank(page, bank) {
		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i in this.items[page][bank]) {
				this.subscribe(this.items[page][bank][i])
			}
		}
	}

	/**
	 * Find an unsubscribe function for an item and execute it
	 * @param {BankItem} item - the item object
	 * @access protected
	 */
	unsubscribe(item) {
		if (item.type !== undefined && item.instance !== undefined) {
			if (this.definitions[item.instance] !== undefined && this.definitions[item.instance][item.type] !== undefined) {
				let definition = this.definitions[item.instance][item.type]
				// Run the subscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(item)
				}
			}
		}
	}

	/**
	 * Execute unsubscribes for all the items in a bank
	 * @param {number} page - the bank's page
	 * @param {number} bank - the bank number
	 * @access public
	 */
	unsubscribeBank(page, bank) {
		if (this.items[page] !== undefined && this.items[page][bank] !== undefined) {
			// find all instance-ids in items for bank
			for (let i in this.items[page][bank]) {
				this.unsubscribe(this.items[page][bank][i])
			}
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
		this.debug('bank_update_item_option', page, bank, item, option, value)
		let bp = this.getBank(page, bank)

		if (bp !== undefined) {
			for (let n in bp) {
				let obj = bp[n]
				if (obj !== undefined && obj.id === item) {
					this.unsubscribeItem(obj)
					if (obj.options === undefined) {
						obj.options = {}
					}
					obj.options[option] = value
					this.subscribeItem(obj)
					this.save()
				}
			}
		}
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
		let bp = this.getBank(page, bank)

		if (bp !== undefined) {
			bp.splice(newIndex, 0, bp.splice(oldIndex, 1)[0])
			this.save()
		}
	}
}

exports = module.exports = BankItemsBase

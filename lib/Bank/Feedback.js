import shortid from 'shortid'
import { sendResult } from '../Resources/Util.js'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { cloneDeep, isEqual } from 'lodash-es'

/**
 * The class that manages the bank feedbacks
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.2.0
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
class BankFeedback extends CoreBase {
	/**
	 * Cached style data for the feedback ids
	 * @type {Object}
	 * @access protected
	 */
	cachedValues = {}
	/**
	 * The feedback definitions
	 * @type {Object}
	 * @access protected
	 */
	definitions = {}
	/**
	 * The feedback data
	 * @type {Object}
	 * @access protected
	 */
	feedbacks

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'feedback', 'lib/Bank/Feedback')

		this.feedbacks = this.db.getKey('feedbacks', {})
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('feedback_get_defaults', this.createItem.bind(this))
		client.on('bank_addFeedback', this.addItem.bind(this, client))
		client.on('bank_delFeedback', this.deleteItemById.bind(this, client))
		client.on('bank_update_feedback_option', this.changeItemOpton.bind(this))
		client.on('bank_update_feedback_order', this.changeItemOrder.bind(this))
		client.on('bank_update_feedback_style_selection', this.changeStyleSelection.bind(this))
		client.on('bank_update_feedback_style_set', this.setItemStyle.bind(this))

		client.on('bank_get_feedbacks', (page, bank, answer) => {
			if (this.feedbacks[page] === undefined) this.feedbacks[page] = {}
			if (this.feedbacks[page][bank] === undefined) this.feedbacks[page][bank] = []
			sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
		})

		client.on('feedback_instance_definitions_get', (answer) => {
			answer(this.definitions)
		})
	}

	/**
	 * Generate a new feedback item for the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} feedback - the instance and type in form: <code>instance_id:type</code>
	 * @param {function} answer - callback for the new feedback item
	 * @access protected
	 */
	addItem(client, page, bank, feedback, answer) {
		if (this.feedbacks[page] === undefined) this.feedbacks[page] = {}
		if (this.feedbacks[page][bank] === undefined) this.feedbacks[page][bank] = []
		let s = feedback.split(/:/)
		let fb = {
			id: shortid.generate(),
			type: s[1],
			instance_id: s[0],
			options: {},
			style: {},
		}

		if (this.definitions[s[0]] !== undefined && this.definitions[s[0]][s[1]] !== undefined) {
			let definition = this.definitions[s[0]][s[1]]

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					let opt = definition.options[j]
					fb.options[opt.id] = opt.default
				}
			}

			if (definition.type === 'boolean' && definition.style) {
				fb.style = { ...definition.style }
			}
		}

		this.feedbacks[page][bank].push(fb)

		if (fb.instance_id === 'internal') {
			this.internalModule.feedbackUpdate(fb, `bank:${page}-${bank}`, page, bank)
		} else {
			const instance = this.instance.moduleHost.getChild(fb.instance_id)
			if (instance) {
				instance.feedbackUpdate(fb, `bank:${page}-${bank}`, page, bank).catch((e) => {
					this.debug(`feedback_update to connection failed: ${e.message}`)
				})
			}
		}

		this.doSave()

		sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
	}

	/**
	 * Update a feedback item option from the IO
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} feedbackId - the feedback id
	 * @param {string} option - the option key
	 * @param {(boolean|number|string)} value - the new value
	 * @access protected
	 */
	changeItemOpton(page, bank, feedbackId, option, value) {
		this.debug('bank_update_feedback_option', page, bank, feedbackId, option, value)
		let feedbacks = this.feedbacks[page][bank]
		if (feedbacks !== undefined) {
			for (const n in feedbacks) {
				let feedback = feedbacks[n]
				if (feedback !== undefined && feedback.id === feedbackId) {
					if (feedback.options === undefined) {
						feedback.options = {}
					}
					feedback.options[option] = value
					this.doSave()

					if (feedback.instance_id === 'internal') {
						this.internalModule.feedbackUpdate(feedback, `bank:${page}-${bank}`, page, bank)
					} else {
						const instance = this.instance.moduleHost.getChild(feedback.instance_id)
						if (instance) {
							instance.feedbackUpdate(feedback, `bank:${page}-${bank}`, page, bank).catch((e) => {
								this.debug(`feedback_update to connection failed: ${e.message}`)
							})
						}
					}
				}
			}
		}
	}

	/**
	 * Change a feedback item's position/order
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {number} oldIndex - the old array index
	 * @param {number} newIndex - the new array index
	 * @access protected
	 */
	changeItemOrder(page, bank, oldIndex, newIndex) {
		let feedbacks = this.feedbacks[page][bank]
		if (feedbacks !== undefined) {
			feedbacks.splice(newIndex, 0, feedbacks.splice(oldIndex, 1)[0])
			this.doSave()
			this.invalidateBankGraphics(page, bank)
		}
	}

	/**
	 * Change the enabled style properties for an item
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} feedbackId - the feedback id
	 * @param {Object} selected - the current style properties
	 * @param {function} answer - callback for the bank's feedbacks
	 * @access protected
	 */
	changeStyleSelection(page, bank, feedbackId, selected, answer) {
		this.debug('bank_update_feedback_style_selection', page, bank, feedbackId, selected)
		let feedbacks = this.feedbacks[page][bank]
		if (feedbacks !== undefined) {
			let bank_obj = this.bank.get(page, bank)

			for (const n in feedbacks) {
				const feedback = feedbacks[n]
				if (feedback !== undefined && feedback.id === feedbackId) {
					const oldStyle = feedback.style || {}

					const feedbackSpec = (this.definitions[feedback.instance_id] || {})[feedback.type]
					const defaultStyle = feedbackSpec ? feedbackSpec.style : {}

					const newStyle = {}
					for (const key of selected) {
						if (key in oldStyle) {
							// preserve existing value
							newStyle[key] = oldStyle[key]
						} else {
							// copy bank value, as a default
							newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : bank_obj[key]

							// png needs to be set to something harmless
							if (key === 'png64' && !newStyle[key]) {
								newStyle[key] = null
							}
						}
					}
					feedback.style = newStyle

					this.doSave()
					this.invalidateBankGraphics(page, bank)

					break
				}
			}

			answer(page, bank, feedbacks)
		}
	}

	/**
	 * Create a feedback item without saving fpr the UI
	 * @param {string} feedback - the instance and type in form: <code>instance_id:type</code>
	 * @param {function} answer - callback for the new feedback item
	 * @access protected
	 */
	createItem(feedback, answer) {
		let s = feedback.split(/:/)
		let fb = {
			id: shortid.generate(),
			type: s[1],
			instance_id: s[0],
			options: {},
			style: {},
		}

		if (this.definitions[s[0]] !== undefined && this.definitions[s[0]][s[1]] !== undefined) {
			let definition = this.definitions[s[0]][s[1]]

			if (definition.options !== undefined && definition.options.length > 0) {
				for (const j in definition.options) {
					let opt = definition.options[j]
					fb.options[opt.id] = opt.default
				}
			}

			if (definition.type === 'boolean' && definition.style) {
				fb.style = { ...definition.style }
			}
		}

		answer(fb)
	}

	/**
	 * Delete an instance's feedbacks
	 * @param {string} instanceId - the instance ID
	 * @access public
	 */
	deleteInstance(instanceId) {
		for (const page in this.feedbacks) {
			for (const bank in this.feedbacks[page]) {
				if (this.feedbacks[page][bank] !== undefined) {
					for (let i = 0; i < this.feedbacks[page][bank].length; ++i) {
						let feedback = this.feedbacks[page][bank][i]

						if (feedback.instance_id == instanceId) {
							this.debug('Deleting feedback ' + i + ' from bank ' + page + '.' + bank)
							this.deleteItemByIndex(page, bank, i)

							i--
						}
					}
				}
			}
		}

		delete this.definitions[instanceId]
		this.io.emit('feedback_instance_definitions_set', instanceId, undefined)
	}

	/**
	 * Delete item by feedback ID for the UI
	 * @param {SocketIO} client - the client socket
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} id - the feedback id
	 * @param {function} answer - callback for the bank's items
	 * @access protected
	 */
	deleteItemById(client, page, bank, id, answer) {
		let feedbacks = this.feedbacks[page][bank]

		for (let i = 0; i < feedbacks.length; ++i) {
			if (feedbacks[i].id == id) {
				this.deleteItemByIndex(page, bank, i)
				break
			}
		}

		this.doSave()
		sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
	}

	/**
	 * Delete item by bank index
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {number} index - the item index
	 * @access protected
	 */
	deleteItemByIndex(page, bank, index) {
		if (
			this.feedbacks[page] !== undefined &&
			this.feedbacks[page][bank] !== undefined &&
			this.feedbacks[page][bank][index] !== undefined
		) {
			const feedback = this.feedbacks[page][bank][index]
			const instance = this.instance.moduleHost.getChild(feedback.instance_id)
			if (instance) {
				instance.feedbackDelete(feedback).catch((e) => {
					this.debug(`feedback_delete to connection failed: ${e.message}`)
				})
			}

			this.feedbacks[page][bank].splice(index, 1)

			delete this.cachedValues[feedback.id]
		}

		this.invalidateBankGraphics(page, bank)
	}

	/**
	 * Save changes
	 * @access protected
	 */
	doSave() {
		this.db.setKey('feedbacks', this.feedbacks)
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
				out = cloneDeep(this.feedbacks)
			} else {
				out = this.feedbacks
			}
		}

		return out
	}

	/**
	 * Get a feedback definition for an instance
	 * @param {string} instanceId - the instance ID
	 * @param {string} type - the feedback type
	 * @returns {Object} the definition
	 * @access public
	 */
	getDefinition(instanceId, type) {
		let out

		if (this.definitions[instanceId] !== undefined && this.definitions[instanceId][type] !== undefined) {
			out = this.definitions[instanceId][type]
		}

		return out
	}

	/**
	 * Get all feedback items for an instance (including Triggers)
	 * @param {string} instanceId - the instance ID
	 * @returns {Object} the feedbacks
	 * @access public
	 */
	getInstanceItems(instanceId) {
		let fbs = []
		for (const page in this.feedbacks) {
			for (const bank in this.feedbacks[page]) {
				for (const i in this.feedbacks[page][bank]) {
					let feedback = this.feedbacks[page][bank][i]
					if (feedback.instance_id == instanceId) {
						fbs.push(feedback)
					}
				}
			}
		}

		const triggerFeedbacks = this.triggers.getAllFeedbacks()
		for (const feedback of triggerFeedbacks) {
			if (feedback.instance_id == instanceId) {
				fbs.push(feedback)
			}
		}

		return fbs
	}

	/**
	 * Get the active style for a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @returns {?Object} the style
	 * @access public
	 */
	getStyleForBank(page, bank) {
		const feedbacks = this.feedbacks[page]?.[bank]
		if (feedbacks) {
			let styles = {}

			// Iterate through feedbacks
			for (const feedback of feedbacks) {
				const definition = this.definitions[feedback.instance_id]?.[feedback.type]
				const rawValue = this.cachedValues[feedback.id]
				if (definition && rawValue !== undefined) {
					if (definition.type === 'boolean' && rawValue == true) {
						styles = {
							...styles,
							...feedback?.style,
						}
					} else if (definition.type === 'advanced' && typeof rawValue === 'object') {
						styles = {
							...styles,
							...rawValue,
						}
					}
				}
			}
			return styles
		} else {
			return undefined
		}
	}

	/**
	 * Import a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {Object} imp - the import config
	 * @access public
	 */
	importBank(page, bank, imp) {
		if (imp !== undefined) {
			if (this.feedbacks[page] === undefined) {
				this.feedbacks[page] = {}
			}
			if (this.feedbacks[page][bank] === undefined) {
				this.feedbacks[page][bank] = []
			}
			let feedbacks = this.feedbacks[page][bank]

			for (let i = 0; i < imp.length; ++i) {
				let obj = imp[i]
				obj.id = shortid.generate()
				feedbacks.push(obj)
			}
		}

		this.subscribeBank(page, bank)
	}

	exportBank(page, bank) {
		return cloneDeep(this.feedbacks[page][bank])
	}

	/**
	 * Invalidate the graphics for a specified bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access protected
	 */
	invalidateBankGraphics(page, bank) {
		this.graphics.invalidateBank(page, bank)
	}

	/**
	 * Scan the feedbacks for any instances that disappeared
	 * @access public
	 */
	verifyInstanceIds() {
		const instances = this.registry.instance

		this.debug('got instance')

		// ensure all feedbacks are valid
		const res = {}
		let changed = false
		for (const page in this.feedbacks) {
			res[page] = {}
			for (const bank in this.feedbacks[page]) {
				res[page][bank] = []

				// Iterate through feedbacks on this bank
				if (this.feedbacks[page][bank] !== undefined) {
					for (const i in this.feedbacks[page][bank]) {
						let feedback = this.feedbacks[page][bank][i]

						if (feedback && instances.getInstanceConfig(feedback.instance_id)) {
							res[page][bank].push(feedback)
						} else {
							changed = true
						}
					}
				}
			}
		}
		this.feedbacks = res

		if (changed === true) {
			this.db.setKey('feedbacks', this.feedbacks)
		}
	}

	/**
	 * Unsubscribe and reset a bank
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access public
	 */
	resetBank(page, bank) {
		if (this.feedbacks[page] === undefined) {
			this.feedbacks[page] = {}
		}
		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			const ps = []
			for (const feedback of this.feedbacks[page][bank]) {
				// remove cached style
				delete this.cachedValues[feedback.id]

				// inform instance
				const instance = this.instance.moduleHost.getChild(feedback.instance_id)
				if (instance) {
					ps.push(instance.feedbackDelete(feedback))
				}
			}
			Promise.all(ps).catch((e) => {
				this.debug(`feedback_unsubscribe_bank for ${page}.${bank} failed: ${e.message}`)
			})

			this.feedbacks[page][bank] = []
		}

		this.doSave()
	}

	/**
	 * Set the feedback definitions for an instance
	 * @param {string} instanceId - the instance ID
	 * @param {object} feedbacks - the feedback definitions
	 * @access public
	 */
	setDefinitions(instanceId, feedbacks) {
		this.definitions[instanceId] = feedbacks
		this.io.emit('feedback_instance_definitions_set', instanceId, feedbacks)
	}

	/**
	 * Set a feedback style items
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {string} feedbackId - the feedback id
	 * @param {string} key - the style key
	 * @param {any} value -the new style value
	 * @param {function} answer - callback for the bank's feedbacks
	 * @access protected
	 */
	setItemStyle(page, bank, feedbackId, key, value, answer) {
		this.debug('bank_update_feedback_style_set', page, bank, feedbackId, key, value)
		let feedbacks = this.feedbacks[page][bank]
		if (feedbacks !== undefined) {
			if (key === 'png64') {
				if (!value.match(/data:.*?image\/png/)) {
					return
				}

				value = value.replace(/^.*base64,/, '')
			}

			for (const n in feedbacks) {
				const feedback = feedbacks[n]
				if (feedback !== undefined && feedback.id === feedbackId) {
					if (!feedback.style) feedback.style = {}
					feedback.style[key] = value

					this.doSave()
					this.invalidateBankGraphics(page, bank)

					answer(page, bank, feedbacks)

					break
				}
			}
		}
	}

	/**
	 * Subscribe all of a bank's items
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @access public
	 */
	subscribeBank(page, bank) {
		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			const ps = []
			for (const feedback of this.feedbacks[page][bank]) {
				if (feedback.instance_id === 'internal') {
					this.internalModule.feedbackUpdate(feedback, `bank:${page}-${bank}`, page, bank)
				} else {
					const instance = this.instance.moduleHost.getChild(feedback.instance_id)
					if (instance) {
						ps.push(instance.feedbackUpdate(feedback, `bank:${page}-${bank}`, page, bank))
					}
				}
			}
			Promise.all(ps).catch((e) => {
				this.debug(`feedback_subscribe_bank for ${page}.${bank} failed: ${e.message}`)
			})
		}
	}

	/**
	 * Update values for some feedbacks
	 * @param {string} instanceId
	 * @param {object} result - object containing new values for the feedbacks that have changed
	 * @access public
	 */
	updateFeedbackValues(instanceId, result) {
		const changedControlIds = new Set()
		const valuesForTriggers = {}

		for (const item of result) {
			if (typeof item.controlId === 'string' && item.controlId.startsWith('bank:')) {
				const [page, bank] = item.controlId.substring(5).split('-')
				const feedbackOnBank = this.feedbacks[page]?.[bank]?.find(
					(i) => i.id === item.id && i.instance_id === instanceId
				)
				if (feedbackOnBank) {
					if (!isEqual(item.value, this.cachedValues[item.id])) {
						// Found the feedback, exactly where it said it would be
						// Mark the bank as changed, and store the new value
						changedControlIds.add(item.controlId)
						this.cachedValues[item.id] = item.value
					}
				}
			} else {
				// hopefully a trigger
				valuesForTriggers[item.id] = item
			}
		}

		// Trigger a re-draw
		for (const controlId of changedControlIds) {
			const [page, bank] = controlId.substring(5).split('-')
			this.invalidateBankGraphics(page, bank)
		}

		this.triggers.updateFeedbackValues(valuesForTriggers, instanceId)
	}
}

export default BankFeedback

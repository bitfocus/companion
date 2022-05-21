import { nanoid } from 'nanoid'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { CreateBankControlId, ParseControlId } from '../Resources/Util.js'

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
	 * The feedback data
	 * @type {Object}
	 * @access protected
	 */
	feedbacks

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'feedback', 'Bank/Feedback')

		this.feedbacks = this.db.getKey('feedbacks', {})
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
							this.logger.silly('Deleting feedback ' + i + ' from bank ' + page + '.' + bank)
							this.deleteItemByIndex(page, bank, i)

							i--
						}
					}
				}
			}
		}
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
				const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
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
				obj.id = nanoid()
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

		this.logger.silly('got instance')

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
	 * Replace a feedback on a bank with an updated version
	 * @param {number} page
	 * @param {number} bank
	 * @param {object} feedback
	 */
	replaceItem(page, bank, newProps) {
		if (this.feedbacks[page] && this.feedbacks[page][bank]) {
			for (const feedback of this.feedbacks[page][bank]) {
				// Replace the new feedback in place
				if (feedback.id === newProps.id) {
					feedback.type = newProps.feedbackId
					feedback.options = newProps.options

					delete feedback.upgradeIndex

					// Preserve existing value if it is set
					feedback.style = feedback.style || newProps.style

					return true
				}
			}
		}

		return false
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
				this.logger.silly(`feedback_unsubscribe_bank for ${page}.${bank} failed: ${e.message}`)
			})

			this.feedbacks[page][bank] = []
		}

		this.doSave()
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
					this.internalModule.feedbackUpdate(feedback, CreateBankControlId(page, bank), page, bank)
				} else {
					const instance = this.instance.moduleHost.getChild(feedback.instance_id)
					if (instance) {
						ps.push(instance.feedbackUpdate(feedback, CreateBankControlId(page, bank), page, bank))
					}
				}
			}
			Promise.all(ps).catch((e) => {
				this.logger.silly(`feedback_subscribe_bank for ${page}.${bank} failed: ${e.message}`)
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
			const parsedControl = ParseControlId(item.controlId)
			if (parsedControl?.type === 'bank') {
				const feedbackOnBank = this.feedbacks[parsedControl.page]?.[parsedControl.bank]?.find(
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
			} else if (parsedControl?.type === 'trigger') {
				valuesForTriggers[item.id] = item
			} else {
				// Ignore for now
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

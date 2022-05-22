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
}

export default BankFeedback

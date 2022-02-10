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

const shortid = require('shortid')
const { isEqual } = require('lodash')
const { sendResult } = require('../Resources/Util')
const CoreBase = require('../Core/Base')
const Registry = require('../Registry')

class BankFeedback extends CoreBase {
	constructor(registry) {
		super(registry, 'feedback', 'lib/Bank/Feedback')

		this.feedback_definitions = {}
		this.feedbacks = this.db.getKey('feedbacks', {})

		this.feedback_styles = {}

		this.system.on('instance', (obj) => {
			this.instances = obj
			this.debug('got instance')

			// ensure all feedbacks are valid
			const res = {}
			for (const page in this.feedbacks) {
				res[page] = {}
				for (const bank in this.feedbacks[page]) {
					res[page][bank] = []

					// Iterate through feedbacks on this bank
					if (this.feedbacks[page][bank] !== undefined) {
						for (const i in this.feedbacks[page][bank]) {
							let feedback = this.feedbacks[page][bank][i]

							if (feedback && this.instances.store.db[feedback.instance_id]) {
								res[page][bank].push(feedback)
							}
						}
					}
				}
			}
			this.feedbacks = res

			this.db.setKey('feedbacks', this.feedbacks)
		})

		this.system.on('bank_reset', (page, bank) => {
			if (this.feedbacks[page] === undefined) {
				this.feedbacks[page] = {}
				this.feedback_styles[page] = {}
			}
			if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
				// find all instance-ids in feedbacks for bank
				for (const i in this.feedbacks[page][bank]) {
					this.unsubscribeFeedback(this.feedbacks[page][bank][i])
				}
				this.feedbacks[page][bank] = []
			}
			if (this.feedback_styles[page] !== undefined && this.feedback_styles[page][bank] !== undefined) {
				this.feedback_styles[page][bank] = []
			}

			this.system.emit('feedback_save')
		})

		this.system.on('feedback_subscribe_bank', (page, bank) => {
			if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
				// find all instance-ids in feedbacks for bank
				for (const i in this.feedbacks[page][bank]) {
					this.subscribeFeedback(this.feedbacks[page][bank][i])
				}
			}
		})

		this.system.on('feedback_subscribe', (feedback) => {
			this.subscribeFeedback(feedback)
		})

		this.system.on('feedback_unsubscribe', (feedback) => {
			this.unsubscribeFeedback(feedback)
		})

		this.system.on('feedback_getall', (cb) => {
			cb(this.feedbacks)
		})

		this.system.on('feedbacks_for_instance', (instance_id, cb) => {
			let fbs = []
			for (const page in this.feedbacks) {
				for (const bank in this.feedbacks[page]) {
					for (const i in this.feedbacks[page][bank]) {
						let feedback = this.feedbacks[page][bank][i]
						if (feedback.instance_id == instance_id) {
							fbs.push(feedback)
						}
					}
				}
			}

			this.system.emit('schedule_get_all_feedbacks', (scheduler_feedbacks) => {
				for (const feedback of scheduler_feedbacks) {
					if (feedback.instance_id == instance_id) {
						fbs.push(feedback)
					}
				}
			})

			cb(fbs)
		})

		this.system.on('feedback_definition_get', (instance_id, type, cb) => {
			if (
				this.feedback_definitions[instance_id] !== undefined &&
				this.feedback_definitions[instance_id][type] !== undefined
			) {
				cb(this.feedback_definitions[instance_id][type])
			} else {
				cb(undefined)
			}
		})

		this.system.on('feedback_check_constraints', (constraints, feedback, cb) => {
			cb(this.checkFeedbackConstraints(constraints, feedback))
		})

		/** Check feedback for a bank. optionally constrain to an instance_id, feedback_types, and feedback_ids */
		this.system.on('feedback_check_bank', (page, bank, constraint) => {
			// Iterate through feedbacks on this bank
			if (this.feedbacks[page][bank] !== undefined) {
				let width, height

				if (this.userconfig.getKey('remove_topbar') === true) {
					width = 72
					height = 72
				} else {
					width = 72
					height = 58
				}

				let bank_obj = this.bank.getBank(page, bank)
				let style_changed = false

				for (const i in this.feedbacks[page][bank]) {
					const feedback = this.feedbacks[page][bank][i]

					if (!this.checkFeedbackConstraints(constraint, feedback)) {
						continue
					}

					let instance
					this.system.emit('instance_get', feedback.instance_id, (inst) => (instance = inst))

					if (instance) {
						let definition
						if (
							this.feedback_definitions[instance.id] !== undefined &&
							this.feedback_definitions[instance.id][feedback.type] !== undefined
						) {
							definition = this.feedback_definitions[instance.id][feedback.type]
						}

						try {
							// Ask instance to check bank for custom styling
							if (
								definition !== undefined &&
								definition.callback !== undefined &&
								typeof definition.callback == 'function'
							) {
								const result = definition.callback(feedback, bank_obj, {
									page: page,
									bank: bank,
									width: width,
									height: height,
								})
								style_changed = this.setCachedStyle(page, bank, i, definition, feedback, result) || style_changed
							} else if (typeof instance.feedback == 'function') {
								const result = instance.feedback(feedback, bank_obj, {
									page: page,
									bank: bank,
									width: width,
									height: height,
								})
								style_changed = this.setCachedStyle(page, bank, i, definition, feedback, result) || style_changed
							} else {
								this.debug('ERROR: instance ' + instance.label + ' does not have a feedback() function')
							}
						} catch (e) {
							this.system.emit(
								'log',
								'instance(' + instance.label + ')',
								'warn',
								'Error checking feedback: ' + e.message
							)
						}
					}
				}

				if (style_changed) {
					this.system.emit('graphics_bank_invalidate', page, bank)
				}
			}
		})

		this.system.on('feedback_check_all', this.checkAll.bind(this))

		this.system.on('feedback_check_all_banks', this.checkAll.bind(this))

		this.system.on('feedback_delete', (page, bank, index) => {
			if (
				this.feedbacks[page] !== undefined &&
				this.feedbacks[page][bank] !== undefined &&
				this.feedbacks[page][bank][index] !== undefined
			) {
				this.unsubscribeFeedback(this.feedbacks[page][bank][index])
				this.feedbacks[page][bank].splice(index, 1)
			}
			if (
				this.feedback_styles[page] !== undefined &&
				this.feedback_styles[page][bank] !== undefined &&
				this.feedback_styles[page][bank][index] !== undefined
			) {
				this.feedback_styles[page][bank].splice(index, 1)
			}

			this.system.emit('graphics_bank_invalidate', page, bank)
		})

		this.system.on('instance_delete', (id) => {
			for (const page in this.feedbacks) {
				for (const bank in this.feedbacks[page]) {
					if (this.feedbacks[page][bank] !== undefined) {
						for (let i = 0; i < this.feedbacks[page][bank].length; ++i) {
							let feedback = this.feedbacks[page][bank][i]

							if (feedback.instance_id == id) {
								this.debug('Deleting feedback ' + i + ' from bank ' + page + '.' + bank)
								this.system.emit('feedback_delete', page, bank, i)

								i--
							}
						}
					}
				}
			}

			delete this.feedback_definitions[id]

			this.io.emit('feedback_get_definitions:result', this.feedback_definitions)
		})

		this.system.on('feedback_save', () => {
			this.db.setKey('feedbacks', this.feedbacks)

			this.debug('saving')
		})

		this.system.on('feedback_get_style', (page, bank, cb) => {
			if (this.feedback_styles[page] === undefined || this.feedback_styles[page][bank] === undefined) {
				return cb(undefined)
			}

			let styles = {}
			for (const i in this.feedback_styles[page][bank]) {
				if (this.feedback_styles[page][bank][i] !== undefined) {
					for (const key in this.feedback_styles[page][bank][i]) {
						styles[key] = this.feedback_styles[page][bank][i][key]
					}
				}
			}
			if (Object.keys(styles).length == 0) {
				return cb(undefined)
			}

			return cb(styles)
		})

		this.system.on('io_connect', (client) => {
			client.on('feedback_get_defaults', (feedback, answer) => {
				let s = feedback.split(/:/)
				let fb = {
					id: shortid.generate(),
					type: s[1],
					instance_id: s[0],
					options: {},
					style: {},
				}

				if (this.feedback_definitions[s[0]] !== undefined && this.feedback_definitions[s[0]][s[1]] !== undefined) {
					let definition = this.feedback_definitions[s[0]][s[1]]

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
			})

			client.on('bank_addFeedback', (page, bank, feedback, answer) => {
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

				if (!this.instances.store.db[fb.instance_id]) {
					// Feedback is not valid
					return
				}

				if (this.feedback_definitions[s[0]] !== undefined && this.feedback_definitions[s[0]][s[1]] !== undefined) {
					let definition = this.feedback_definitions[s[0]][s[1]]

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
				this.subscribeFeedback(fb)

				this.system.emit('feedback_save')
				this.system.emit('feedback_check_bank', page, bank, { instance_id: fb.instance_id, feedback_ids: [fb.id] })

				sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
			})

			client.on('bank_delFeedback', (page, bank, id, answer) => {
				let feedbacks = this.feedbacks[page][bank]

				for (let i = 0; i < feedbacks.length; ++i) {
					if (feedbacks[i].id == id) {
						this.system.emit('feedback_delete', page, bank, i)
						break
					}
				}

				this.system.emit('feedback_save')
				sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
			})

			client.on('bank_update_feedback_option', (page, bank, feedbackid, option, value) => {
				this.debug('bank_update_feedback_option', page, bank, feedbackid, option, value)
				let feedbacks = this.feedbacks[page][bank]
				if (feedbacks !== undefined) {
					for (const n in feedbacks) {
						let feedback = feedbacks[n]
						if (feedback !== undefined && feedback.id === feedbackid) {
							this.unsubscribeFeedback(feedback)
							if (feedback.options === undefined) {
								feedback.options = {}
							}
							feedback.options[option] = value
							this.system.emit('feedback_save')
							this.system.emit('feedback_check_bank', page, bank, {
								instance_id: feedback.instance_id,
								feedback_ids: [feedback.id],
							})
							this.subscribeFeedback(feedback)
						}
					}
				}
			})

			client.on('bank_get_feedbacks', (page, bank, answer) => {
				if (this.feedbacks[page] === undefined) this.feedbacks[page] = {}
				if (this.feedbacks[page][bank] === undefined) this.feedbacks[page][bank] = []
				sendResult(client, answer, 'bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank])
			})

			client.on('bank_update_feedback_order', (page, bank, old_index, new_index) => {
				let feedbacks = this.feedbacks[page][bank]
				if (feedbacks !== undefined) {
					feedbacks.splice(new_index, 0, feedbacks.splice(old_index, 1)[0])
					this.system.emit('feedback_save')
					this.system.emit('feedback_check_bank', page, bank)
				}
			})

			client.on('feedback_get_definitions', () => {
				client.emit('feedback_get_definitions:result', this.feedback_definitions)
			})

			client.on('bank_update_feedback_style_selection', (page, bank, feedbackid, selected, answer) => {
				this.debug('bank_update_feedback_style_selection', page, bank, feedbackid, selected)
				let feedbacks = this.feedbacks[page][bank]
				if (feedbacks !== undefined) {
					let bank_obj = this.bank.getBank(page, bank)

					for (const n in feedbacks) {
						const feedback = feedbacks[n]
						if (feedback !== undefined && feedback.id === feedbackid) {
							const oldStyle = feedback.style || {}

							const feedbackSpec = (this.feedback_definitions[feedback.instance_id] || {})[feedback.type]
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

							this.system.emit('feedback_save')
							this.system.emit('feedback_check_bank', page, bank, {
								instance_id: feedback.instance_id,
								feedback_ids: [feedback.id],
							})

							break
						}
					}

					answer(page, bank, feedbacks)
				}
			})

			client.on('bank_update_feedback_style_set', (page, bank, feedbackid, key, value, answer) => {
				this.debug('bank_update_feedback_style_set', page, bank, feedbackid, key, value)
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
						if (feedback !== undefined && feedback.id === feedbackid) {
							if (!feedback.style) feedback.style = {}
							feedback.style[key] = value

							this.system.emit('feedback_save')
							this.system.emit('feedback_check_bank', page, bank, {
								instance_id: feedback.instance_id,
								feedback_ids: [feedback.id],
							})

							answer(page, bank, feedbacks)

							break
						}
					}
				}
			})
		})
	}

	setFeedbackDefinitions(instance_id, feedbacks) {
		this.feedback_definitions[instance_id] = feedbacks
		this.io.emit('feedback_get_definitions:result', this.feedback_definitions)
	}

	/**
	 * Check all feedbacks on all banks that match the specified constraints
	 * @param {object} constraints
	 */
	checkAll(constraints) {
		if (this.feedbacks !== undefined) {
			for (const page in this.feedbacks) {
				for (const bank in this.feedbacks[page]) {
					// Iterate through feedbacks on this bank
					this.system.emit('feedback_check_bank', page, bank, constraints)
				}
			}
		}
	}

	/** Check if a feedback is supposed to be checked, for some constraints */
	checkFeedbackConstraints(constraint, feedback) {
		if (constraint) {
			// check if limited to an instance_id
			if (constraint.instance_id && constraint.instance_id !== feedback.instance_id) {
				return false
			}
			// check if limited to feedback types
			if (
				constraint.feedback_types &&
				constraint.feedback_types.length !== 0 &&
				!constraint.feedback_types.includes(feedback.type)
			) {
				return false
			}
			// check if limited to feedback ids
			if (
				constraint.feedback_ids &&
				constraint.feedback_ids.length !== 0 &&
				!constraint.feedback_ids.includes(feedback.id)
			) {
				return false
			}
		}
		return true
	}

	/**
	 * Execute the subscribe callback for a feedback
	 * @param {object} feedback
	 */
	subscribeFeedback(feedback) {
		if (feedback.type !== undefined && feedback.instance_id !== undefined) {
			if (
				this.feedback_definitions[feedback.instance_id] !== undefined &&
				this.feedback_definitions[feedback.instance_id][feedback.type] !== undefined
			) {
				let definition = this.feedback_definitions[feedback.instance_id][feedback.type]
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(feedback)
				}
			}
		}
	}

	/**
	 * Execute the unsubscribe callback for a feedback
	 * @param {object} feedback
	 */
	unsubscribeFeedback(feedback) {
		if (feedback.type !== undefined && feedback.instance_id !== undefined) {
			if (
				this.feedback_definitions[feedback.instance_id] !== undefined &&
				this.feedback_definitions[feedback.instance_id][feedback.type] !== undefined
			) {
				let definition = this.feedback_definitions[feedback.instance_id][feedback.type]
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(feedback)
				}
			}
		}
	}

	/**
	 * Cache the style returned from a feedback
	 * @param {number} page
	 * @param {number} bank
	 * @param {number} index
	 * @param {object} definition the definition of the feedback type
	 * @param {object} feedback the feedback object
	 * @param {object | boolean} style the style to set or a boolean
	 * @returns whether the cached style was changed
	 */
	setCachedStyle(page, bank, index, definition, feedback, style) {
		if ((definition && definition.type === 'boolean') || typeof style === 'boolean') {
			if (style) {
				style = { ...feedback.style }
			} else {
				style = {}
			}
		}

		if (this.feedback_styles[page] === undefined) {
			this.feedback_styles[page] = {}
		}

		if (this.feedback_styles[page][bank] === undefined) {
			this.feedback_styles[page][bank] = []
		}

		if (!isEqual(style, this.feedback_styles[page][bank][index])) {
			this.debug('Feedback changed style of bank ' + page + '.' + bank)
			this.feedback_styles[page][bank][index] = style
			return true
		} else {
			return false
		}
	}
}

module.exports = BankFeedback

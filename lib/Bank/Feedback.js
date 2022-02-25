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
const { sendResult } = require('../Resources/Util')
const CoreBase = require('../Core/Base')
const Registry = require('../Registry')

class BankFeedback extends CoreBase {
	constructor(registry) {
		super(registry, 'feedback', 'lib/Bank/Feedback')

		this.feedback_definitions = {}
		this.feedbacks = this.db.getKey('feedbacks', {})

		/** Cached values from each feedback */
		this.feedback_values = {}

		this.system.on('instance', (obj) => {
			const instances = obj
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

							if (feedback && instances.store.db[feedback.instance_id]) {
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
			}
			if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
				const ps = []
				for (const feedback of this.feedbacks[page][bank]) {
					// remove cached style
					delete this.feedback_values[feedback.id]

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

			this.system.emit('feedback_save')
		})

		this.system.on('feedback_subscribe_bank', (page, bank) => {
			if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
				// find all instance-ids in feedbacks for bank
				const ps = []
				for (const feedback of this.feedbacks[page][bank]) {
					const instance = this.instance.moduleHost.getChild(feedback.instance_id)
					if (instance) {
						ps.push(instance.feedbackUpdate(feedback, page, bank))
					}
				}
				Promise.all(ps).catch((e) => {
					this.debug(`feedback_subscribe_bank for ${page}.${bank} failed: ${e.message}`)
				})
			}
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

		this.system.on('feedback_delete', (page, bank, index) => {
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

				delete this.feedback_values[feedback.id]
			}

			this.invalidateBankGraphics(page, bank)
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
			this.io.emit('feedback_instance_definitions_set', id, undefined)
		})

		this.system.on('feedback_save', () => {
			this.db.setKey('feedbacks', this.feedbacks)

			this.debug('saving')
		})

		this.system.on('feedback_get_style', (page, bank, cb) => {
			const feedbacks = this.feedbacks[page]?.[bank]
			if (feedbacks) {
				let styles = {}

				// Iterate through feedbacks
				for (const feedback of feedbacks) {
					const definition = this.feedback_definitions[feedback.instance_id]?.[feedback.type]
					const rawValue = this.feedback_values[feedback.id]
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

				return cb(styles)
			} else {
				return cb(undefined)
			}
		})
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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
			const instance = this.instance.moduleHost.getChild(fb.instance_id)
			if (instance) {
				instance.feedbackUpdate(fb, page, bank).catch((e) => {
					this.debug(`feedback_update to connection failed: ${e.message}`)
				})
			}

			this.system.emit('feedback_save')

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
						if (feedback.options === undefined) {
							feedback.options = {}
						}
						feedback.options[option] = value
						this.system.emit('feedback_save')

						const instance = this.instance.moduleHost.getChild(feedback.instance_id)
						if (instance) {
							instance.feedbackUpdate(feedback, page, bank).catch((e) => {
								this.debug(`feedback_update to connection failed: ${e.message}`)
							})
						}
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
				this.invalidateBankGraphics(page, bank)
			}
		})

		client.on('feedback_instance_definitions_get', (answer) => {
			answer(this.feedback_definitions)
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
						this.invalidateBankGraphics(page, bank)

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
						this.invalidateBankGraphics(page, bank)

						answer(page, bank, feedbacks)

						break
					}
				}
			}
		})
	}

	/**
	 * Invalidate the graphics for a specified bank
	 * @access private
	 * @param {number} page
	 * @param {number} bank
	 */
	invalidateBankGraphics(page, bank) {
		this.system.emit('graphics_bank_invalidate', page, bank)
	}

	/**
	 * Update values for some feedbacks
	 * @access public
	 * @param {string} instance_id
	 * @param {object} result - object containing new values for the feedbacks that have changed
	 */
	updateFeedbackValues(instance_id, result) {
		const changedControlIds = new Set()
		const valuesForTriggers = {}

		for (const item of result) {
			if (typeof item.controlId === 'string' && item.controlId.startsWith('bank:')) {
				const [page, bank] = item.controlId.substring(5).split('-')
				const feedbackOnBank = this.feedbacks[page]?.[bank]?.find(
					(i) => i.id === item.id && i.instance_id === instance_id
				)
				if (feedbackOnBank) {
					// Found the feedback, exactly where it said it would be
					// Mark the bank as changed, and store the new value
					changedControlIds.add(item.controlId)
					this.feedback_values[item.id] = item.value
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

		this.system.emit('triggers_update_feedback_values', valuesForTriggers, instance_id)
	}

	/**
	 * Set the feedback definitions for an instance
	 * @access public
	 * @param {string} instance_id
	 * @param {object} feedbacks
	 */
	setFeedbackDefinitions(instance_id, feedbacks) {
		this.feedback_definitions[instance_id] = feedbacks
		this.io.emit('feedback_instance_definitions_set', instance_id, feedbacks)
	}
}

module.exports = BankFeedback

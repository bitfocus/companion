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

var system
var io
var debug = require('debug')('lib/feedback')
var _ = require('lodash')
var shortid = require('shortid')

function feedback(system) {
	var self = this

	system.emit('io_get', function (_io) {
		self.io = io = _io
	})

	self.system = system
	self.feedback_definitions = {}
	self.feedbacks = {}

	self.system.emit('db_get', 'feedbacks', function (res) {
		if (res !== undefined) {
			self.feedbacks = res
		}
	})

	self.feedback_styles = {}

	self.system.on('instance', function (obj) {
		self.instance = obj
		debug('got instance')

		// ensure all feedbacks are valid
		const res = {}
		for (var page in self.feedbacks) {
			res[page] = {}
			for (var bank in self.feedbacks[page]) {
				res[page][bank] = []

				// Iterate through feedbacks on this bank
				if (self.feedbacks[page][bank] !== undefined) {
					for (var i in self.feedbacks[page][bank]) {
						var feedback = self.feedbacks[page][bank][i]

						if (feedback && self.instance.store.db[feedback.instance_id]) {
							res[page][bank].push(feedback)
						}
					}
				}
			}
		}
		self.feedbacks = res

		self.system.emit('db_set', 'feedbacks', self.feedbacks)
		self.system.emit('db_save')
	})

	system.on('feedback_instance_definitions_set', function (instance, feedbacks) {
		self.feedback_definitions[instance.id] = feedbacks
		io.emit('feedback_get_definitions:result', self.feedback_definitions)
	})

	system.on('feedback_update', function () {
		io.emit('feedback_get_definitions:result', self.feedback_definitions)
	})

	system.on('bank_reset', function (page, bank) {
		if (self.feedbacks[page] === undefined) {
			self.feedbacks[page] = {}
			self.feedback_styles[page] = {}
		}
		if (self.feedbacks[page] !== undefined && self.feedbacks[page][bank] !== undefined) {
			system.emit('feedback_unsubscribe_bank', page, bank)
			self.feedbacks[page][bank] = []
		}
		if (self.feedback_styles[page] !== undefined && self.feedback_styles[page][bank] !== undefined) {
			self.feedback_styles[page][bank] = []
		}

		self.system.emit('feedback_save')
	})

	system.on('feedback_subscribe_bank', function (page, bank) {
		if (self.feedbacks[page] !== undefined && self.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i in self.feedbacks[page][bank]) {
				self.subscribeFeedback(self.feedbacks[page][bank][i])
			}
		}
	})

	system.on('feedback_unsubscribe_bank', function (page, bank) {
		if (self.feedbacks[page] !== undefined && self.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i in self.feedbacks[page][bank]) {
				self.unsubscribeFeedback(self.feedbacks[page][bank][i])
			}
		}
	})

	system.on('feedback_subscribe', function (feedback) {
		self.subscribeFeedback(feedback)
	})

	system.on('feedback_unsubscribe', function (feedback) {
		self.unsubscribeFeedback(feedback)
	})

	system.on('feedback_getall', function (cb) {
		cb(self.feedbacks)
	})

	system.on('feedbacks_for_instance', function (instance_id, cb) {
		var fbs = []
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {
				for (var i in self.feedbacks[page][bank]) {
					var feedback = self.feedbacks[page][bank][i]
					if (feedback.instance_id == instance_id) {
						fbs.push(feedback)
					}
				}
			}
		}

		self.system.emit('schedule_get_all_feedbacks', (scheduler_feedbacks) => {
			for (const feedback of scheduler_feedbacks) {
				if (feedback.instance_id == instance_id) {
					fbs.push(feedback)
				}
			}
		})

		cb(fbs)
	})

	system.on('feedback_definition_get', function (instance_id, type, cb) {
		if (
			self.feedback_definitions[instance_id] !== undefined &&
			self.feedback_definitions[instance_id][type] !== undefined
		) {
			cb(self.feedback_definitions[instance_id][type])
		} else {
			cb(undefined)
		}
	})

	system.on('feedback_check_constraints', function (constraints, feedback, cb) {
		cb(self.checkFeedbackConstraints(constraints, feedback))
	})

	/** Check feedback for a bank. optionally constrain to an instance_id, feedback_types, and feedback_ids */
	system.on('feedback_check_bank', function (page, bank, constraint) {
		// Iterate through feedbacks on this bank
		if (self.feedbacks[page][bank] !== undefined) {
			system.emit('get_bank', page, bank, function (bank_obj) {
				let style_changed = false

				for (var i in self.feedbacks[page][bank]) {
					const feedback = self.feedbacks[page][bank][i]

					if (!self.checkFeedbackConstraints(constraint, feedback)) {
						continue
					}

					let instance
					self.system.emit('instance_get', feedback.instance_id, (inst) => (instance = inst))

					if (instance) {
						var definition
						if (
							self.feedback_definitions[instance.id] !== undefined &&
							self.feedback_definitions[instance.id][feedback.type] !== undefined
						) {
							definition = self.feedback_definitions[instance.id][feedback.type]
						}

						try {
							// Ask instance to check bank for custom styling
							if (
								definition !== undefined &&
								definition.callback !== undefined &&
								typeof definition.callback == 'function'
							) {
								const result = definition.callback(feedback, bank_obj, { page: page, bank: bank })
								style_changed = self.setCachedStyle(page, bank, i, definition, feedback, result) || style_changed
							} else if (typeof instance.feedback == 'function') {
								const result = instance.feedback(feedback, bank_obj, { page: page, bank: bank })
								style_changed = self.setCachedStyle(page, bank, i, definition, feedback, result) || style_changed
							} else {
								debug('ERROR: instance ' + instance.label + ' does not have a feedback() function')
							}
						} catch (e) {
							self.system.emit(
								'log',
								'instance(' + instance.label + ')',
								'warn',
								'Error checking feedback: ' + e.message
							)
						}
					}
				}

				if (style_changed) {
					self.system.emit('graphics_bank_invalidate', page, bank)
				}
			})
		}
	})

	system.on('feedback_check_all', function (constraints) {
		//debug('Instance ' + instance.label + ' wants us to check banks (' + type + ')');
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {
				// Iterate through feedbacks on this bank
				system.emit('feedback_check_bank', page, bank, constraints)
			}
		}
	})

	system.on('feedback_delete', function (page, bank, index) {
		if (
			self.feedbacks[page] !== undefined &&
			self.feedbacks[page][bank] !== undefined &&
			self.feedbacks[page][bank][index] !== undefined
		) {
			self.unsubscribeFeedback(self.feedbacks[page][bank][index])
			self.feedbacks[page][bank].splice(index, 1)
		}
		if (
			self.feedback_styles[page] !== undefined &&
			self.feedback_styles[page][bank] !== undefined &&
			self.feedback_styles[page][bank][index] !== undefined
		) {
			self.feedback_styles[page][bank].splice(index, 1)
		}

		system.emit('graphics_bank_invalidate', page, bank)
	})

	system.on('instance_delete', function (id) {
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {
				if (self.feedbacks[page][bank] !== undefined) {
					for (var i = 0; i < self.feedbacks[page][bank].length; ++i) {
						var feedback = self.feedbacks[page][bank][i]

						if (feedback.instance_id == id) {
							debug('Deleting feedback ' + i + ' from bank ' + page + '.' + bank)
							system.emit('feedback_delete', page, bank, i)

							i--
						}
					}
				}
			}
		}

		delete self.feedback_definitions[id]

		self.system.emit('feedback_update')
	})

	system.on('feedback_save', function () {
		self.system.emit('db_set', 'feedbacks', self.feedbacks)
		self.system.emit('db_save')

		debug('saving')
	})

	system.on('feedback_get_style', function (page, bank, cb) {
		if (self.feedback_styles[page] === undefined || self.feedback_styles[page][bank] === undefined) {
			return cb(undefined)
		}

		var styles = {}
		for (var i in self.feedback_styles[page][bank]) {
			if (self.feedback_styles[page][bank][i] !== undefined) {
				for (var key in self.feedback_styles[page][bank][i]) {
					styles[key] = self.feedback_styles[page][bank][i][key]
				}
			}
		}
		if (Object.keys(styles).length == 0) {
			return cb(undefined)
		}

		return cb(styles)
	})

	system.on('io_connect', function (client) {
		function sendResult(answer, name, ...args) {
			if (typeof answer === 'function') {
				answer(...args)
			} else {
				client.emit(name, ...args)
			}
		}

		client.on('feedback_get_defaults', function (feedback, answer) {
			var s = feedback.split(/:/)
			var fb = {
				id: shortid.generate(),
				type: s[1],
				instance_id: s[0],
				options: {},
				style: {},
			}

			if (self.feedback_definitions[s[0]] !== undefined && self.feedback_definitions[s[0]][s[1]] !== undefined) {
				var definition = self.feedback_definitions[s[0]][s[1]]

				if (definition.options !== undefined && definition.options.length > 0) {
					for (var j in definition.options) {
						var opt = definition.options[j]
						fb.options[opt.id] = opt.default
					}
				}

				if (definition.type === 'boolean' && definition.style) {
					fb.style = { ...definition.style }
				}
			}

			answer(fb)
		})

		client.on('bank_addFeedback', function (page, bank, feedback, answer) {
			if (self.feedbacks[page] === undefined) self.feedbacks[page] = {}
			if (self.feedbacks[page][bank] === undefined) self.feedbacks[page][bank] = []
			var s = feedback.split(/:/)
			var fb = {
				id: shortid.generate(),
				type: s[1],
				instance_id: s[0],
				options: {},
				style: {},
			}

			if (!self.instance.store.db[fb.instance_id]) {
				// Feedback is not valid
				return
			}

			if (self.feedback_definitions[s[0]] !== undefined && self.feedback_definitions[s[0]][s[1]] !== undefined) {
				var definition = self.feedback_definitions[s[0]][s[1]]

				if (definition.options !== undefined && definition.options.length > 0) {
					for (var j in definition.options) {
						var opt = definition.options[j]
						fb.options[opt.id] = opt.default
					}
				}

				if (definition.type === 'boolean' && definition.style) {
					fb.style = { ...definition.style }
				}
			}

			self.feedbacks[page][bank].push(fb)
			self.subscribeFeedback(fb)

			system.emit('feedback_save')
			self.system.emit('feedback_check_bank', page, bank, { instance_id: fb.instance_id, feedback_ids: [fb.id] })

			sendResult(answer, 'bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank])
		})

		client.on('bank_delFeedback', function (page, bank, id, answer) {
			var feedbacks = self.feedbacks[page][bank]

			for (var i = 0; i < feedbacks.length; ++i) {
				if (feedbacks[i].id == id) {
					system.emit('feedback_delete', page, bank, i)
					break
				}
			}

			system.emit('feedback_save')
			sendResult(answer, 'bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank])
		})

		client.on('bank_update_feedback_option', function (page, bank, feedbackid, option, value) {
			debug('bank_update_feedback_option', page, bank, feedbackid, option, value)
			var feedbacks = self.feedbacks[page][bank]
			if (feedbacks !== undefined) {
				for (var n in feedbacks) {
					var feedback = feedbacks[n]
					if (feedback !== undefined && feedback.id === feedbackid) {
						self.unsubscribeFeedback(feedback)
						if (feedback.options === undefined) {
							feedback.options = {}
						}
						feedback.options[option] = value
						self.system.emit('feedback_save')
						self.system.emit('feedback_check_bank', page, bank, {
							instance_id: feedback.instance_id,
							feedback_ids: [feedback.id],
						})
						self.subscribeFeedback(feedback)
					}
				}
			}
		})

		client.on('bank_get_feedbacks', function (page, bank, answer) {
			if (self.feedbacks[page] === undefined) self.feedbacks[page] = {}
			if (self.feedbacks[page][bank] === undefined) self.feedbacks[page][bank] = []
			sendResult(answer, 'bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank])
		})

		client.on('bank_update_feedback_order', function (page, bank, old_index, new_index) {
			var feedbacks = self.feedbacks[page][bank]
			if (feedbacks !== undefined) {
				feedbacks.splice(new_index, 0, feedbacks.splice(old_index, 1)[0])
				self.system.emit('feedback_save')
				self.system.emit('feedback_check_bank', page, bank)
			}
		})

		client.on('feedback_get_definitions', function () {
			client.emit('feedback_get_definitions:result', self.feedback_definitions)
		})

		client.on('bank_update_feedback_style_selection', function (page, bank, feedbackid, selected, answer) {
			debug('bank_update_feedback_style_selection', page, bank, feedbackid, selected)
			var feedbacks = self.feedbacks[page][bank]
			if (feedbacks !== undefined) {
				system.emit('get_bank', page, bank, function (bank_obj) {
					for (var n in feedbacks) {
						const feedback = feedbacks[n]
						if (feedback !== undefined && feedback.id === feedbackid) {
							const oldStyle = feedback.style || {}

							const feedbackSpec = (self.feedback_definitions[feedback.instance_id] || {})[feedback.type]
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

							self.system.emit('feedback_save')
							self.system.emit('feedback_check_bank', page, bank, {
								instance_id: feedback.instance_id,
								feedback_ids: [feedback.id],
							})

							break
						}
					}

					answer(page, bank, feedbacks)
				})
			}
		})

		client.on('bank_update_feedback_style_set', function (page, bank, feedbackid, key, value, answer) {
			debug('bank_update_feedback_style_set', page, bank, feedbackid, key, value)
			var feedbacks = self.feedbacks[page][bank]
			if (feedbacks !== undefined) {
				if (key === 'png64') {
					if (!value.match(/data:.*?image\/png/)) {
						return
					}

					value = value.replace(/^.*base64,/, '')
				}

				for (var n in feedbacks) {
					const feedback = feedbacks[n]
					if (feedback !== undefined && feedback.id === feedbackid) {
						if (!feedback.style) feedback.style = {}
						feedback.style[key] = value

						self.system.emit('feedback_save')
						self.system.emit('feedback_check_bank', page, bank, {
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

/** Check if a feedback is supposed to be checked, for some constraints */
feedback.prototype.checkFeedbackConstraints = function (constraint, feedback) {
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

feedback.prototype.subscribeFeedback = function (feedback) {
	var self = this

	if (feedback.type !== undefined && feedback.instance_id !== undefined) {
		if (
			self.feedback_definitions[feedback.instance_id] !== undefined &&
			self.feedback_definitions[feedback.instance_id][feedback.type] !== undefined
		) {
			let definition = self.feedback_definitions[feedback.instance_id][feedback.type]
			// Run the subscribe function if needed
			if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
				definition.subscribe(feedback)
			}
		}
	}
}

feedback.prototype.unsubscribeFeedback = function (feedback) {
	var self = this

	if (feedback.type !== undefined && feedback.instance_id !== undefined) {
		if (
			self.feedback_definitions[feedback.instance_id] !== undefined &&
			self.feedback_definitions[feedback.instance_id][feedback.type] !== undefined
		) {
			let definition = self.feedback_definitions[feedback.instance_id][feedback.type]
			// Run the unsubscribe function if needed
			if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
				definition.unsubscribe(feedback)
			}
		}
	}
}

feedback.prototype.setCachedStyle = function (page, bank, index, definition, feedback, style) {
	var self = this

	if ((definition && definition.type === 'boolean') || typeof style === 'boolean') {
		if (style) {
			style = { ...feedback.style }
		} else {
			style = {}
		}
	}

	if (self.feedback_styles[page] === undefined) {
		self.feedback_styles[page] = {}
	}

	if (self.feedback_styles[page][bank] === undefined) {
		self.feedback_styles[page][bank] = []
	}

	if (!_.isEqual(style, self.feedback_styles[page][bank][index])) {
		debug('Feedback changed style of bank ' + page + '.' + bank)
		self.feedback_styles[page][bank][index] = style
		return true
	} else {
		return false
	}
}

exports = module.exports = function (system) {
	return new feedback(system)
}

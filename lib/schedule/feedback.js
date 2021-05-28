const plugin_base = require('./plugin_base')
const debug = require('debug')('lib/schedule/feedback')

/** Even though the plugin has said it will have multiple, the caller flattens the array and we need to fight that */
function ensure_array(v) {
	if (Array.isArray(v)) {
		return v
	} else if (v) {
		return [v]
	} else {
		return []
	}
}

class feedback extends plugin_base {
	setup() {
		this.scheduler.system.on('feedback_check_all', this.check_feedbacks.bind(this))

		this.scheduler.system.on('schedule_get_all_feedbacks', this.get_all_feedbacks.bind(this))

		// hack: the ui has the behaviour hardcoded due to how different it is
		this.options = []
	}

	get multiple() {
		return true
	}

	/**
	 * Add event to watch for
	 * @param {number} id
	 * @param {Object} data
	 */
	add(id, data) {
		const data2 = {
			...data,
			last_values: {},
			last_value: false,
		}

		super.add(id, data2)

		for (const fb of ensure_array(data2.config)) {
			this.scheduler.system.emit('feedback_subscribe', fb)
		}

		this.check_entry(data2)
	}

	/**
	 * Remove event from watch list
	 * @param {number} id
	 */
	remove(id) {
		const feedback = this.watch.find((c) => c.id === id)
		if (feedback) {
			for (const fb of ensure_array(feedback.config)) {
				this.scheduler.system.emit('feedback_unsubscribe', fb)
			}
		}
		super.remove(id)
	}

	get_all_feedbacks(cb) {
		const feedbacks = []
		for (const fb of this.watch) {
			feedbacks.push(...ensure_array(fb.config))
		}
		cb(feedbacks)
	}

	/**
	 * An instance has requested that its feedbacks are checked
	 */
	check_feedbacks(constraints) {
		for (const entry of this.watch) {
			this.check_entry(entry, constraints)
		}
	}

	check_entry(entry, constraints) {
		const feedbacks = ensure_array(entry.config)

		// Iterate through the feedbacks and invalidate any which should be rechecked
		for (const feedback of feedbacks) {
			let last_value = entry.last_values[feedback.id]

			if (last_value !== undefined) {
				// don't recheck this one if we have a value, and we've not been told to

				let recheck = false
				this.scheduler.system.emit('feedback_check_constraints', constraints, feedback, (a) => {
					recheck = a
				})
				if (recheck) {
					delete entry.last_values[feedback.id]
				}
			}
		}

		let entry_new_value = true // Start with true, as we do an and down the line
		if (feedbacks.length === 0) {
			// no feedbacks means always false
			entry_new_value = false
		}

		// Now build our result value and lazy calculate and values we need
		for (const feedback of feedbacks) {
			let new_value = entry.last_values[feedback.id]
			if (new_value === undefined) {
				let instance
				this.scheduler.system.emit('instance_get', feedback.instance_id, (inst) => {
					instance = inst
				})

				if (instance) {
					let definition
					this.scheduler.system.emit('feedback_definition_get', feedback.instance_id, feedback.type, (def) => {
						definition = def
					})

					try {
						// Ask instance to check bank for custom styling
						if (definition !== undefined && typeof definition.callback == 'function') {
							new_value = definition.callback(feedback, null, null)
						} else if (instance !== undefined && typeof instance.feedback == 'function') {
							new_value = instance.feedback(feedback, null, null)
						} else {
							debug(`ERROR: unable to check feedback "${instance.label}:${feedback.type}"`)
						}
					} catch (e) {
						this.scheduler.system.emit(
							'log',
							'feedback(' + instance.label + ')',
							'warn',
							'Error checking feedback: ' + e.message
						)
						new_value = false
					}
				}
			}

			// We need to have a bool here
			if (typeof new_value !== 'boolean') new_value = false

			if (entry.last_values[feedback.id] !== new_value) {
				entry.last_values[feedback.id] = new_value
			}

			// update the result
			entry_new_value = entry_new_value && new_value
		}

		// check for a change
		if (entry.last_value != entry_new_value) {
			entry.last_value = entry_new_value

			// Run it when going to true
			if (entry_new_value) {
				this.scheduler.action(entry.id)
			}
		}
	}

	get type() {
		return 'feedback'
	}

	get name() {
		return 'Feedback'
	}

	_cond_desc(feedback) {
		let definition
		this.scheduler.system.emit('feedback_definition_get', feedback.instance_id, feedback.type, (def) => {
			definition = def
		})

		let instance
		this.scheduler.system.emit('instance_config_get', feedback.instance_id, (inst) => {
			instance = inst
		})
		const instanceLabel = instance ? instance.label : 'Missing'

		if (definition) {
			return `${instanceLabel}: ${definition.label}`
		} else {
			return `${instanceLabel}: ${feedback.type} (undefined)`
		}
	}

	config_desc(config) {
		let cond_list = []
		if (Array.isArray(config)) {
			config.forEach((x) => cond_list.push(this._cond_desc(x)))
		} else if (config) {
			cond_list.push(this._cond_desc(config))
		}
		return `Runs on feedbacks <strong>${cond_list.join('</strong> AND <strong>')}</strong>.`
	}
}

module.exports = feedback

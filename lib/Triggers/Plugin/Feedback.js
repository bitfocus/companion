import TriggersPluginBase from './Base.js'
import { nanoid } from 'nanoid'
import LogController from '../../Log/Controller.js'
import { CreateTriggerControlId } from '../../Resources/Util.js'

const logger = LogController.createLogger('Trigger/Plugin/Feedback')

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

class TriggersPluginFeedback extends TriggersPluginBase {
	setup() {
		// hack: the ui has the behaviour hardcoded due to how different it is
		this.options = []
	}

	/**
	 * Add event to watch for
	 * @param {number} id
	 * @param {Object} data
	 */
	add(id, data) {
		// Ensure the feedbacks are an array
		data.config = ensure_array(data.config)

		const data2 = {
			...data,
			last_values: {},
			last_value: false,
		}

		super.add(id, data2)

		const controlId = CreateTriggerControlId(id)

		const ps = []
		for (const fb of ensure_array(data2.config)) {
			if (fb.instance_id === 'internal') {
				this.scheduler.registry.internalModule.feedbackUpdate(fb, controlId)
			} else {
				const instance = this.scheduler.instance.moduleHost.getChild(fb.instance_id)
				if (instance) {
					ps.push(instance.feedbackUpdate(fb, controlId))
				}
			}
		}
		Promise.all(ps).catch((e) => {
			logger.warn(`feedback_subscribe for trigger failed: ${e.message}`)
		})

		// this.check_entry(data2)
	}

	clone(config) {
		const new_config = super.clone(config)
		new_config.config = ensure_array(new_config.config)

		for (const fb of new_config.config) {
			fb.id = nanoid()
		}

		return new_config
	}

	/**
	 * Remove event from watch list
	 * @param {number} id
	 */
	remove(id) {
		const feedback = this.watch.find((c) => c.id === id)
		if (feedback) {
			const ps = []
			for (const fb of ensure_array(feedback.config)) {
				const instance = this.scheduler.instance.moduleHost.getChild(fb.instance_id)
				if (instance) {
					ps.push(instance.feedbackDelete(fb))
				}
			}
			Promise.all(ps).catch((e) => {
				logger.warn(`feedback_unsubscribe for trigger failed: ${e.message}`)
			})
		}
		super.remove(id)
	}

	getAllFeedbacks(cb) {
		const feedbacks = []
		for (const fb of this.watch) {
			feedbacks.push(
				...ensure_array(fb.config).map((f) => ({
					...f,
					triggerId: fb.id,
				}))
			)
		}
		return feedbacks
	}

	/** Feedback has changed, find it and recheck the trigger */
	updateFeedbackValues(values, instance_id) {
		for (const entry of this.watch) {
			const feedbacks = ensure_array(entry.config)

			let entry_new_value = true // Start with true, as we do an and down the line
			if (feedbacks.length === 0) {
				// no feedbacks means always false
				entry_new_value = false
			}

			// Iterate through the feedbacks and invalidate any which should be rechecked
			for (const feedback of feedbacks) {
				if (feedback.instance_id === instance_id) {
					let new_value = values[feedback.id]?.value
					if (new_value !== undefined) {
						// We need to have a bool here
						if (typeof new_value !== 'boolean') new_value = false

						if (entry.last_values[feedback.id] !== new_value) {
							entry.last_values[feedback.id] = new_value
						}
					}
				}

				// update the result
				entry_new_value = entry_new_value && entry.last_values[feedback.id]
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
	}

	replaceFeedbackItem(id, newProps) {
		const entry = this.watch.find((e) => e.id === id)
		if (entry) {
			const feedbacks = ensure_array(entry.config)

			for (const feedback of feedbacks) {
				if (feedback.id === newProps.id) {
					feedback.type = newProps.feedbackId
					feedback.options = newProps.options

					delete feedback.upgradeIndex

					return true
				}
			}
		}

		return false
	}

	get type() {
		return 'feedback'
	}

	get name() {
		return 'Feedback'
	}

	_cond_desc(feedback) {
		const definition = this.scheduler.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
		const instanceLabel = feedback.instance_id
			? 'Internal'
			: this.scheduler.instance.getLabelForInstance(feedback.instance_id) || 'Missing'

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

export default TriggersPluginFeedback

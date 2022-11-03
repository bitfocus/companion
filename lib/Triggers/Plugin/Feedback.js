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
}

export default TriggersPluginFeedback

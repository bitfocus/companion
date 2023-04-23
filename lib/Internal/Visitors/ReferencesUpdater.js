import { SplitVariableId } from '../../Resources/Util.js'
import { replaceVariableInstancesInString } from '../../Instance/Variable.js'

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class InternalReferencesUpdater {
	constructor(instanceLabelsRemap, instanceIdRemap) {
		this.instanceLabelsRemap = instanceLabelsRemap
		this.instanceIdRemap = instanceIdRemap
		this.changedFeedbackIds = new Set()
		this.changed = false
	}

	#trackChange(feedbackId) {
		this.changed = true
		if (feedbackId) this.changedFeedbackIds.add(feedbackId)
	}

	visitExpression(obj, propName, feedbackId) {
		this.visitString(obj, propName, feedbackId)
	}

	visitInstanceId(obj, propName, feedbackId) {
		if (!this.instanceIdRemap) return

		const oldId = obj[propName]
		const newId = this.instanceIdRemap[oldId]
		if (newId && newId !== oldId) {
			obj[propName] = newId

			this.#trackChange(feedbackId)
		}
	}
	visitInstanceIdArray(obj, propName, feedbackId) {
		if (!this.instanceIdRemap) return

		const array = obj[propName]
		for (let i = 0; i < array.length; i++) {
			this.visitInstanceId(array, i)
		}
	}

	visitString(obj, propName, feedbackId) {
		if (!this.instanceLabelsRemap) return

		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		obj[propName] = replaceVariableInstancesInString(this.instanceLabelsRemap, rawStr)

		if (obj[propName] !== rawStr) this.#trackChange(feedbackId)
	}

	visitVariableName(obj, propName, feedbackId) {
		if (!this.instanceLabelsRemap) return

		const id = SplitVariableId(obj[propName])
		const newLabel = this.instanceLabelsRemap[id[0]]
		console.log('remap', newLabel, obj, propName)
		if (newLabel) {
			obj[propName] = `${newLabel}:${id[1]}`

			this.#trackChange(feedbackId)
		}
	}
}

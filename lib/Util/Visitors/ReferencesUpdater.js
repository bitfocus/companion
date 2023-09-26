import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class VisitorReferencesUpdater {
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

		const entries = Object.entries(this.instanceLabelsRemap)
		if (entries.length === 1) {
			// Fast path
			const [fromlabel, tolabel] = entries[0]
			obj[propName] = rawStr.replaceAll(`$(${fromlabel}:`, `$(${tolabel}:`)
		} else {
			// Slow route

			// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
			const reg = /\$\(([^:$)]+):/g

			const newStr = rawStr.replaceAll(reg, (match, oldLabel) => {
				const newLabel = this.instanceLabelsRemap[oldLabel]
				if (newLabel) {
					return `$(${newLabel}:`
				} else {
					// Unchanged
					return match
				}
			})

			obj[propName] = newStr
		}

		if (obj[propName] !== rawStr) this.#trackChange(feedbackId)
	}

	visitVariableName(obj, propName, feedbackId) {
		if (!this.instanceLabelsRemap) return

		const id = SplitVariableId(obj[propName])
		const newLabel = this.instanceLabelsRemap[id[0]]
		if (newLabel) {
			obj[propName] = `${newLabel}:${id[1]}`

			this.#trackChange(feedbackId)
		}
	}
}

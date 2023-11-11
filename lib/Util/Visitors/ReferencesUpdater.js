import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class VisitorReferencesUpdater {
	/**
	 * Instance label remapping
	 * @type {Record<string, string> | undefined}
	 * @access public
	 * @readonly
	 */
	connectionLabelsRemap

	/**
	 * Instance id remapping
	 * @type {Record<string, string> | undefined}
	 * @access public
	 * @readonly
	 */
	connectionIdRemap

	/**
	 * Feedback ids that have been changed
	 * @type {Set<string>}
	 * @access public
	 * @readonly
	 */
	changedFeedbackIds = new Set()

	/**
	 * Whether any changes have been made
	 * @type {boolean}
	 * @access public
	 */
	changed = false

	/**
	 * @param {Record<string, string> | undefined} connectionLabelsRemap
	 * @param {Record<string, string> | undefined} connectionIdRemap
	 */
	constructor(connectionLabelsRemap, connectionIdRemap) {
		this.connectionLabelsRemap = connectionLabelsRemap
		this.connectionIdRemap = connectionIdRemap
	}

	/**
	 * Track a feedback as having changed
	 * @param {string | undefined} feedbackId
	 */
	#trackChange(feedbackId) {
		this.changed = true
		if (feedbackId) this.changedFeedbackIds.add(feedbackId)
	}

	/**
	 * Visit an instance id property
	 * @param {Record<string, any>} obj
	 * @param {string | number} propName
	 * @param {string=} feedbackId
	 */
	visitInstanceId(obj, propName, feedbackId) {
		if (!this.connectionIdRemap) return

		const oldId = obj[propName]
		const newId = this.connectionIdRemap[oldId]
		if (newId && newId !== oldId) {
			obj[propName] = newId

			this.#trackChange(feedbackId)
		}
	}
	/**
	 * Visit an instance id array property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} feedbackId
	 */
	visitInstanceIdArray(obj, propName, feedbackId) {
		if (!this.connectionIdRemap) return

		const array = obj[propName]
		for (let i = 0; i < array.length; i++) {
			this.visitInstanceId(array, i, feedbackId)
		}
	}

	/**
	 * Visit a property containing variables
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} feedbackId
	 */
	visitString(obj, propName, feedbackId) {
		if (!this.connectionLabelsRemap) return

		const labelsRemap = this.connectionLabelsRemap

		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		const entries = Object.entries(labelsRemap)
		if (entries.length === 1) {
			// Fast path
			const [fromlabel, tolabel] = entries[0]
			obj[propName] = rawStr.replaceAll(`$(${fromlabel}:`, `$(${tolabel}:`)
		} else {
			// Slow route

			// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
			const reg = /\$\(([^:$)]+):/g

			const newStr = rawStr.replaceAll(reg, (match, oldLabel) => {
				const newLabel = labelsRemap[oldLabel]
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

	/**
	 * Visit a variable name property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} feedbackId
	 */
	visitVariableName(obj, propName, feedbackId) {
		if (!this.connectionLabelsRemap) return

		const id = SplitVariableId(obj[propName])
		const newLabel = this.connectionLabelsRemap[id[0]]
		if (newLabel) {
			obj[propName] = `${newLabel}:${id[1]}`

			this.#trackChange(feedbackId)
		}
	}
}

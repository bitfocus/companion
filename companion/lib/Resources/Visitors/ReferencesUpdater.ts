import { TrySplitVariableId } from '../Util.js'

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class VisitorReferencesUpdater {
	/**
	 * connection label remapping
	 */
	readonly connectionLabelsRemap: Record<string, string> | undefined

	/**
	 * connection id remapping
	 */
	readonly connectionIdRemap: Record<string, string> | undefined

	/**
	 * Feedback ids that have been changed
	 */
	readonly changedFeedbackIds = new Set<string>()

	/**
	 * Whether any changes have been made
	 */
	changed: boolean = false

	constructor(
		connectionLabelsRemap: Record<string, string> | undefined,
		connectionIdRemap: Record<string, string> | undefined
	) {
		this.connectionLabelsRemap = connectionLabelsRemap
		this.connectionIdRemap = connectionIdRemap
	}

	/**
	 * Track a feedback as having changed
	 */
	#trackChange(feedbackId: string | undefined): void {
		this.changed = true
		if (feedbackId) this.changedFeedbackIds.add(feedbackId)
	}

	/**
	 * Visit a connection id property
	 */
	visitConnectionId(obj: Record<string, any>, propName: string | number, feedbackId?: string): void {
		if (!this.connectionIdRemap) return

		const oldId = obj[propName]
		const newId = this.connectionIdRemap[oldId]
		if (newId && newId !== oldId) {
			obj[propName] = newId

			this.#trackChange(feedbackId)
		}
	}
	/**
	 * Visit a connection id array property
	 */
	visitConnectionIdArray(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		if (!this.connectionIdRemap) return

		const array = obj[propName]
		for (let i = 0; i < array.length; i++) {
			this.visitConnectionId(array, i, feedbackId)
		}
	}

	/**
	 * Visit a property containing variables
	 */
	visitString(obj: Record<string, any>, propName: string, feedbackId?: string): void {
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
	 */
	visitVariableName(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		if (!this.connectionLabelsRemap) return

		const id = TrySplitVariableId(obj[propName])
		if (!id) return

		const newLabel = this.connectionLabelsRemap[id[0]]
		if (newLabel) {
			obj[propName] = `${newLabel}:${id[1]}`

			this.#trackChange(feedbackId)
		}
	}
}

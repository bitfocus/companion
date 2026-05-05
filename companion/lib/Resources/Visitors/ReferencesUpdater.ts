import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { TrySplitVariableId } from '@companion-app/shared/Variables.js'
import type { InternalController } from '../../Internal/Controller.js'
import { VisitorReferencesBase } from './VisitorReferencesBase.js'

export class VisitorReferencesUpdater extends VisitorReferencesBase<VisitorReferencesUpdaterVisitor> {
	constructor(
		internalModule: InternalController,
		connectionLabelsRemap: Record<string, string> | undefined,
		connectionIdRemap: Record<string, string> | undefined
	) {
		super(internalModule, new VisitorReferencesUpdaterVisitor(connectionLabelsRemap, connectionIdRemap))
	}

	recheckChangedFeedbacks(): this {
		// Trigger the feedbacks to be rechecked, this will cause a redraw if needed
		if (this.visitor.changedFeedbackIds.size > 0) {
			this.internalModule.checkFeedbacksById(...this.visitor.changedFeedbackIds)
		}

		return this
	}

	hasChanges(): boolean {
		return this.visitor.changed
	}
}

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class VisitorReferencesUpdaterVisitor {
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

		this.#updateValue(obj, propName, (oldValue, isExpression) => {
			if (!this.connectionIdRemap || isExpression) return oldValue // An expression can't be a plain connection id

			const newId = this.connectionIdRemap[oldValue]
			if (newId && newId !== oldValue) {
				this.#trackChange(feedbackId)
				return newId
			}
			return oldValue
		})
	}
	/**
	 * Visit a connection id array property
	 */
	visitConnectionIdArray(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		if (!this.connectionIdRemap) return

		this.#updateValue(obj, propName, (oldValue, isExpression) => {
			if (isExpression || !Array.isArray(oldValue)) return oldValue // An expression can't be a plain connection id

			for (let i = 0; i < oldValue.length; i++) {
				this.visitConnectionId(oldValue, i, feedbackId)
			}

			return oldValue // update in place
		})
	}

	/**
	 * Visit a property containing variables
	 */
	visitString(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		if (!this.connectionLabelsRemap) return

		const labelsRemap = this.connectionLabelsRemap

		this.#updateValue(obj, propName, (oldValue, _isExpression) => {
			if (typeof oldValue !== 'string') return oldValue

			let newValue = oldValue

			const entries = Object.entries(labelsRemap)
			if (entries.length === 1) {
				// Fast path
				const [fromlabel, tolabel] = entries[0]
				newValue = oldValue.replaceAll(`$(${fromlabel}:`, `$(${tolabel}:`)
			} else {
				// Slow route

				// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
				const reg = /\$\(([^:$)]+):/g

				newValue = oldValue.replaceAll(reg, (match, oldLabel) => {
					const newLabel = labelsRemap[oldLabel]
					if (newLabel) {
						return `$(${newLabel}:`
					} else {
						// Unchanged
						return match
					}
				})
			}

			if (oldValue !== newValue) this.#trackChange(feedbackId)

			return newValue
		})
	}

	/**
	 * Visit a variable name property
	 */
	visitVariableName(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		if (!this.connectionLabelsRemap) return

		this.#updateValue(obj, propName, (oldValue, isExpression) => {
			if (!this.connectionLabelsRemap || isExpression || typeof oldValue !== 'string') return oldValue // An expression can't be a plain variable name

			const id = TrySplitVariableId(oldValue)
			if (!id) return oldValue

			const newLabel = this.connectionLabelsRemap[id[0]]
			if (newLabel) {
				this.#trackChange(feedbackId)
				return `${newLabel}:${id[1]}`
			}
			return oldValue
		})
	}

	/**
	 * Update a value on the object.
	 * Note: the updater must return the value to preserve, even if unchanged. And fire the #trackChange if needed
	 */
	#updateValue(
		obj: Record<string, any>,
		propName: string | number,
		updater: (oldValue: any, isExpression: boolean) => any
	): void {
		const value = obj[propName]
		if (isExpressionOrValue(value)) {
			obj[propName] = {
				...value,
				value: updater(value.value, value.isExpression),
			}
		} else {
			obj[propName] = updater(value, false)
		}
	}
}

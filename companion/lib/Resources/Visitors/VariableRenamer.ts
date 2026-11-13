import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { InternalController } from '../../Internal/Controller.js'
import { VisitorReferencesBase } from './VisitorReferencesBase.js'

/**
 * Renames one variable wherever the entities refer to it, such as an input of a custom action used as
 * `$(options:<id>)`
 */
export class VisitorVariableRenamer extends VisitorReferencesBase<VisitorVariableRenamerVisitor> {
	/**
	 * @param fromVariableId The variable to rename, eg `options:old`
	 * @param toVariableId What to rename it to, eg `options:new`
	 */
	constructor(internalModule: InternalController, fromVariableId: string, toVariableId: string) {
		super(internalModule, new VisitorVariableRenamerVisitor(fromVariableId, toVariableId))
	}

	recheckChangedFeedbacks(): this {
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
 * Visit the properties of actions and feedbacks, renaming one variable
 */
export class VisitorVariableRenamerVisitor {
	readonly #fromVariableId: string
	readonly #toVariableId: string

	/**
	 * Feedback ids that have been changed
	 */
	readonly changedFeedbackIds = new Set<string>()

	/**
	 * Whether any changes have been made
	 */
	changed: boolean = false

	constructor(fromVariableId: string, toVariableId: string) {
		this.#fromVariableId = fromVariableId
		this.#toVariableId = toVariableId
	}

	#trackChange(feedbackId: string | undefined): void {
		this.changed = true
		if (feedbackId) this.changedFeedbackIds.add(feedbackId)
	}

	visitOutboundSurfaceId(_obj: Record<string, any>, _propName: string | number, _feedbackId?: string): void {
		// Not a variable
	}

	visitConnectionId(_obj: Record<string, any>, _propName: string | number, _feedbackId?: string): void {
		// Not a variable
	}

	visitConnectionIdArray(_obj: Record<string, any>, _propName: string, _feedbackId?: string): void {
		// Not a variable
	}

	/**
	 * Visit a property containing variables
	 */
	visitString(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		const from = `$(${this.#fromVariableId})`
		const to = `$(${this.#toVariableId})`

		this.#updateValue(obj, propName, (oldValue) => {
			if (typeof oldValue !== 'string' || !oldValue.includes(from)) return oldValue

			this.#trackChange(feedbackId)
			return oldValue.replaceAll(from, to)
		})
	}

	/**
	 * Visit a variable name property
	 */
	visitVariableName(obj: Record<string, any>, propName: string, feedbackId?: string): void {
		this.#updateValue(obj, propName, (oldValue, isExpression) => {
			// An expression can't be a plain variable name
			if (isExpression || oldValue !== this.#fromVariableId) return oldValue

			this.#trackChange(feedbackId)
			return this.#toVariableId
		})
	}

	/**
	 * Update a value on the object, which may be wrapped as an expression or value
	 */
	#updateValue(
		obj: Record<string, any>,
		propName: string | number,
		updater: (oldValue: any, isExpression: boolean) => any
	): void {
		const value = obj[propName]
		if (isExpressionOrValue(value)) {
			obj[propName] = { ...value, value: updater(value.value, value.isExpression) }
		} else {
			obj[propName] = updater(value, false)
		}
	}
}

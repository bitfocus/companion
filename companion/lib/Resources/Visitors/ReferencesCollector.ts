import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { InternalController } from '../../Internal/Controller.js'
import { TrySplitVariableId } from '@companion-app/shared/Variables.js'
import { VisitorReferencesBase } from './VisitorReferencesBase.js'

export class VisitorReferencesCollector extends VisitorReferencesBase<VisitorReferencesCollectorVisitor> {
	constructor(
		internalModule: InternalController,
		foundConnectionIds: Set<string> | undefined,
		foundConnectionLabels: Set<string> | undefined,
		foundVariables: Set<string> | undefined
	) {
		super(
			internalModule,
			new VisitorReferencesCollectorVisitor(foundConnectionIds, foundConnectionLabels, foundVariables)
		)
	}
}

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class VisitorReferencesCollectorVisitor {
	/**
	 * Referenced connection labels
	 */
	readonly connectionLabels: Set<string>

	/**
	 * Referenced connection ids
	 */
	readonly connectionIds: Set<string>

	/**
	 * Referenced variables
	 */
	readonly variables: Set<string>

	constructor(
		foundConnectionIds: Set<string> | undefined,
		foundConnectionLabels: Set<string> | undefined,
		foundVariables: Set<string> | undefined
	) {
		this.connectionLabels = foundConnectionLabels || new Set()
		this.connectionIds = foundConnectionIds || new Set()
		this.variables = foundVariables || new Set()
	}

	/**
	 * Visit a connection id property
	 */
	visitConnectionId(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
		const connectionId = this.#getAndUnwrapPropertyValue(obj, propName)
		if (typeof connectionId !== 'string') return

		this.connectionIds.add(connectionId)
	}
	/**
	 * Visit a connection id array property
	 */
	visitConnectionIdArray(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
		const connectionIds = this.#getAndUnwrapPropertyValue(obj, propName)
		if (!Array.isArray(connectionIds)) return

		for (const id of connectionIds) {
			if (typeof id === 'string') this.connectionIds.add(id)
		}
	}

	/**
	 * Visit a property containing variables
	 */
	visitString(obj: Record<string, any>, propName: string): void {
		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
		const reg = /\$\(([^:$)]+):([^$)]+)\)/g

		const matches = rawStr.matchAll(reg)
		for (const match of matches) {
			this.connectionLabels.add(match[1])
			this.variables.add(`${match[1]}:${match[2]}`) // Store full variable reference
		}
	}

	/**
	 * Visit a variable name property
	 */
	visitVariableName(obj: Record<string, any>, propName: string): void {
		const variableName = this.#getAndUnwrapPropertyValue(obj, propName)
		if (typeof variableName !== 'string') return

		const label = TrySplitVariableId(variableName)
		if (label) {
			this.connectionLabels.add(label[0])
			this.variables.add(variableName)
		}
	}

	#getAndUnwrapPropertyValue(obj: Record<string, any>, propName: string): any {
		const value = obj[propName]
		if (isExpressionOrValue(value) && value.isExpression) {
			return value.value
		}
		return value
	}
}

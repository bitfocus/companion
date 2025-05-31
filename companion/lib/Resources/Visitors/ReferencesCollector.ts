import type { InternalController } from '../../Internal/Controller.js'
import { TrySplitVariableId } from '../Util.js'
import { VisitorReferencesBase } from './VisitorReferencesBase.js'

export class VisitorReferencesCollector extends VisitorReferencesBase<VisitorReferencesCollectorVisitor> {
	constructor(
		internalModule: InternalController,
		foundConnectionIds: Set<string> | undefined,
		foundConnectionLabels: Set<string> | undefined
	) {
		super(internalModule, new VisitorReferencesCollectorVisitor(foundConnectionIds, foundConnectionLabels))
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

	constructor(foundConnectionIds: Set<string> | undefined, foundConnectionLabels: Set<string> | undefined) {
		this.connectionLabels = foundConnectionLabels || new Set()
		this.connectionIds = foundConnectionIds || new Set()
	}

	/**
	 * Visit a connection id property
	 */
	visitConnectionId(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
		this.connectionIds.add(obj[propName])
	}
	/**
	 * Visit a connection id array property
	 */
	visitConnectionIdArray(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
		for (const id of obj[propName]) {
			this.connectionIds.add(id)
		}
	}

	/**
	 * Visit a property containing variables
	 */
	visitString(obj: Record<string, any>, propName: string): void {
		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
		const reg = /\$\(([^:$)]+):/g

		const matches = rawStr.matchAll(reg)
		for (const match of matches) {
			this.connectionLabels.add(match[1])
		}
	}

	/**
	 * Visit a variable name property
	 */
	visitVariableName(obj: Record<string, any>, propName: string): void {
		const label = TrySplitVariableId(obj[propName])
		if (label) this.connectionLabels.add(label[0])
	}
}

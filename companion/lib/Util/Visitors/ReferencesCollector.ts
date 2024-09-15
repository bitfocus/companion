import { TrySplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class VisitorReferencesCollector {
	/**
	 * Referenced instance labels
	 */
	readonly connecionLabels: Set<string>

	/**
	 * Referenced instance ids
	 */
	readonly connectionIds: Set<string>

	constructor(foundConnectionIds: Set<string> | undefined, foundConnectionLabels: Set<string> | undefined) {
		this.connecionLabels = foundConnectionLabels || new Set()
		this.connectionIds = foundConnectionIds || new Set()
	}

	/**
	 * Visit an instance id property
	 */
	visitInstanceId(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
		this.connectionIds.add(obj[propName])
	}
	/**
	 * Visit an instance id array property
	 */
	visitInstanceIdArray(obj: Record<string, any>, propName: string, _feedbackId?: string): void {
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
			this.connecionLabels.add(match[1])
		}
	}

	/**
	 * Visit a variable name property
	 */
	visitVariableName(obj: Record<string, any>, propName: string): void {
		const label = TrySplitVariableId(obj[propName])
		if (label) this.connecionLabels.add(label[0])
	}
}

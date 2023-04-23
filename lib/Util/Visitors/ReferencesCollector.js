import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class VisitorReferencesCollector {
	constructor(foundInstanceIds, foundInstanceLabels) {
		this.instanceLabels = foundInstanceLabels || new Set()
		this.instanceIds = foundInstanceIds || new Set()
	}

	visitExpression(obj, propName) {
		this.visitString(obj, propName)
	}

	visitInstanceId(obj, propName) {
		this.instanceIds.add(obj[propName])
	}
	visitInstanceIdArray(obj, propName) {
		for (const id of obj[propName]) {
			this.instanceIds.add(id)
		}
	}

	visitString(obj, propName) {
		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
		const reg = /\$\(([^:$)]+):/g

		const matches = rawStr.matchAll(reg)
		for (const match of matches) {
			this.instanceLabels.add(match[1])
		}
	}

	visitVariableName(obj, propName) {
		const label = SplitVariableId(obj[propName])[0]
		this.instanceLabels.add(label)
	}
}

import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class InternalReferencesCollector {
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
		const labels = findVariableInstancesInString(obj[propName])
		for (const label of labels) {
			this.instanceLabels.add(SplitVariableId(label)[0])
		}
	}

	visitVariableName(obj, propName) {
		const label = SplitVariableId(obj[propName])[0]
		this.instanceLabels.add(label)
	}
}

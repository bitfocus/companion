import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class InternalReferencesCollector {
	constructor(foundInstanceIds, foundInstanceLabels) {
		this.instanceLabels = foundInstanceLabels || new Set()
		this.instanceIds = foundInstanceIds || new Set()
	}

	applyExpression(obj, propName) {
		this.applyString(obj, propName)
	}

	applyInstanceId(obj, propName) {
		this.instanceIds.add(obj[propName])
	}
	applyInstanceIdArray(obj, propName) {
		for (const id of obj[propName]) {
			foundInstanceIds.add(id)
		}
	}

	applyString(obj, propName) {
		const labels = findVariableInstancesInString(obj[propName])
		for (const label of labels) {
			foundInstanceLabels.add(SplitVariableId(label)[0])
		}
	}

	applyVariableName(obj, propName) {
		const label = SplitVariableId(obj[propName])[0]
		this.instanceLabels.add(label)
	}
}

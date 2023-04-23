import { SplitVariableId } from '../../Resources/Util.js'
import { replaceVariableInstancesInString } from '../../Instance/Variable.js'

/**
 * Visit property on actions and feedbacks, and update any references used
 */
export class InternalReferencesUpdater {
	constructor(instanceLabelsRemap, instanceIdRemap) {
		this.instanceLabelsRemap = instanceLabelsRemap
		this.instanceIdRemap = instanceIdRemap
		this.changed = false
	}

	applyExpression(obj, propName) {
		this.applyString(obj, propName)
	}

	applyInstanceId(obj, propName) {
		if (!this.instanceIdRemap) return

		const oldId = obj[propName]
		const newId = this.instanceIdRemap[oldId]
		if (newId && newId !== oldId) {
			obj[propName] = newId
			this.changed = true
		}
	}
	applyInstanceIdArray(obj, propName) {
		if (!this.instanceIdRemap) return

		const array = obj[propName]
		for (let i = 0; i < array.length; i++) {
			this.applyInstanceId(array, i)
		}
	}

	applyString(obj, propName) {
		if (!this.instanceLabelsRemap) return

		const rawStr = obj[propName]
		if (typeof rawStr !== 'string') return

		obj[propName] = replaceVariableInstancesInString(this.instanceLabelsRemap, rawStr)
	}

	applyVariableName(obj, propName) {
		if (!this.instanceLabelsRemap) return

		const id = SplitVariableId(obj[propName])
		const newLabel = this.instanceLabelsRemap[id[0]]
		console.log('remap', newLabel, obj, propName)
		if (newLabel) {
			obj[propName] = `${newLabel}:${id[1]}`
			this.changed = true
		}
	}
}

import { SplitVariableId } from '../../Resources/Util.js'

/**
 * Visit property on actions and feedbacks, and collect any references used
 */
export class VisitorReferencesCollector {
	/**
	 * Referenced instance labels
	 * @type {Set<string>}
	 * @access public
	 * @readonly
	 */
	instanceLabels

	/**
	 * Referenced instance ids
	 * @type {Set<string>}
	 * @access public
	 * @readonly
	 */
	instanceIds

	/**
	 * @param {Set<string> | undefined} foundInstanceIds
	 * @param {Set<string> | undefined} foundInstanceLabels
	 */
	constructor(foundInstanceIds, foundInstanceLabels) {
		this.instanceLabels = foundInstanceLabels || new Set()
		this.instanceIds = foundInstanceIds || new Set()
	}

	/**
	 * Visit an instance id property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} _feedbackId
	 */
	visitInstanceId(obj, propName, _feedbackId) {
		this.instanceIds.add(obj[propName])
	}
	/**
	 * Visit an instance id array property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} _feedbackId
	 */
	visitInstanceIdArray(obj, propName, _feedbackId) {
		for (const id of obj[propName]) {
			this.instanceIds.add(id)
		}
	}

	/**
	 * Visit a property containing variables
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 */
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

	/**
	 * Visit a variable name property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 */
	visitVariableName(obj, propName) {
		const label = SplitVariableId(obj[propName])[0]
		this.instanceLabels.add(label)
	}
}

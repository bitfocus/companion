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
	connecionLabels

	/**
	 * Referenced instance ids
	 * @type {Set<string>}
	 * @access public
	 * @readonly
	 */
	connectionIds

	/**
	 * @param {Set<string> | undefined} foundConnectionIds
	 * @param {Set<string> | undefined} foundConnectionLabels
	 */
	constructor(foundConnectionIds, foundConnectionLabels) {
		this.connecionLabels = foundConnectionLabels || new Set()
		this.connectionIds = foundConnectionIds || new Set()
	}

	/**
	 * Visit an instance id property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} _feedbackId
	 */
	visitInstanceId(obj, propName, _feedbackId) {
		this.connectionIds.add(obj[propName])
	}
	/**
	 * Visit an instance id array property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 * @param {string=} _feedbackId
	 */
	visitInstanceIdArray(obj, propName, _feedbackId) {
		for (const id of obj[propName]) {
			this.connectionIds.add(id)
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
			this.connecionLabels.add(match[1])
		}
	}

	/**
	 * Visit a variable name property
	 * @param {Record<string, any>} obj
	 * @param {string} propName
	 */
	visitVariableName(obj, propName) {
		const label = SplitVariableId(obj[propName])[0]
		this.connecionLabels.add(label)
	}
}

/**
 * @typedef {{label?: string; sortOrder?: number}} MinimalInstanceInfo
 */

/**
 *
 * @param {[id: string, obj: MinimalInstanceInfo | undefined]} param0
 * @param {[id: string, obj: MinimalInstanceInfo | undefined]} param1
 * @returns number
 */
export function compareExportedInstances([aId, aObj], [bId, bObj]) {
	if (!aObj || !bObj) return 0 // Satisfy typings

	// If order is the same, sort by label
	if (bObj.sortOrder === aObj.sortOrder) {
		return (aObj.label ?? aId).localeCompare(bObj.label ?? bId)
	}

	// sort by order
	return (aObj.sortOrder ?? Number.POSITIVE_INFINITY) - (bObj.sortOrder ?? Number.POSITIVE_INFINITY)
}

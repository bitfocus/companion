/**
 *
 * @param {[id: string, obj: import("../Data/Model/ExportModel.js").ExportInstanceFullv4 | import("../Data/Model/ExportModel.js").ExportInstanceMinimalv4 | undefined]} param0
 * @param {[id: string, obj: import("../Data/Model/ExportModel.js").ExportInstanceFullv4 | import("../Data/Model/ExportModel.js").ExportInstanceMinimalv4 | undefined]} param1
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

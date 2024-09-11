export type MinimalInstanceInfo = { label?: string; sortOrder?: number }

export function compareExportedInstances(
	[aId, aObj]: [id: string, obj: MinimalInstanceInfo | undefined],
	[bId, bObj]: [id: string, obj: MinimalInstanceInfo | undefined]
): number {
	if (!aObj || !bObj) return 0 // Satisfy typings

	// If order is the same, sort by label
	if (bObj.sortOrder === aObj.sortOrder) {
		return (aObj.label ?? aId).localeCompare(bObj.label ?? bId)
	}

	// sort by order
	return (aObj.sortOrder ?? Number.POSITIVE_INFINITY) - (bObj.sortOrder ?? Number.POSITIVE_INFINITY)
}

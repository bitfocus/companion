/**
 * Generic group API interface for reusable collapsible group operations
 */
export interface GroupApi {
	addNewGroup: (groupName?: string) => void
	renameGroup: (groupId: string, newName: string) => void
	deleteGroup: (groupId: string) => void
	moveGroup: (groupId: string, parentId: string | null, dropIndex: number) => void
	moveItemToGroup: (itemId: string, groupId: string | null, dropIndex: number) => void
}

export interface GroupingTableGroup {
	id: string
	label?: string
	sortOrder?: number
	children: this[]
}

export interface GroupingTableItem {
	id: string
	groupId: string | null
	sortOrder: number
}

/**
 * Generic group API interface for reusable collapsible group operations
 */
export interface NestingCollectionsApi {
	createCollection: (collectionName?: string) => void
	renameCollection: (collectionId: string, newName: string) => void
	deleteCollection: (collectionId: string) => void
	moveCollection: (collectionId: string, parentId: string | null, dropIndex: number) => void
	moveItemToCollection: (itemId: string, collectionId: string | null, dropIndex: number) => void
}

export interface CollectionsNestingTableCollection {
	id: string
	label?: string
	children: this[]
}

export interface CollectionsNestingTableItem {
	id: string
	collectionId: string | null
	sortOrder: number
}

export interface PageModel {
	id: string
	name: string
	controls: Record<number, Record<number, string>>
}

export interface ClientPagesInfo {
	order: string[]

	pages: Record<string, PageModel | undefined>
}

export interface PageModelChanges {
	updatedOrder: string[] | null

	added: PageModel[]
	changes: PageModelChangesItem[]
}

export interface PageModelChangesItem {
	id: string
	name: string | null

	controls: Array<{ row: number; column: number; controlId: string | null }>
}

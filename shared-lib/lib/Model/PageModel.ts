export interface PageModel {
	id: string
	name: string
	controls: Record<number, Record<number, string>>
}

export type PageModelChanges = PageModelChangesInit | PageModelChangesUpdate

export interface PageModelChangesInit {
	type: 'init'

	order: string[]

	pages: Record<string, PageModel | undefined>
}

export interface PageModelChangesUpdate {
	type: 'update'
	updatedOrder: string[] | null

	added: PageModel[]
	changes: PageModelChangesItem[]
}

export interface PageModelChangesItem {
	id: string
	name: string | null

	controls: Array<{ row: number; column: number; controlId: string | null }>
}

import z from 'zod'

/** The entries of an object whose key is an integer and whose value is valid, dropping the rest */
function validGridEntries(value: unknown, isValidValue: (entry: unknown) => boolean): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
	return Object.fromEntries(Object.entries(value).filter(([key, entry]) => /^-?\d+$/.test(key) && isValidValue(entry)))
}

/**
 * A page's grid of control ids, by row then column. An invalid entry is dropped on its own, rather than failing
 * the page: a page that doesn't load leaves a gap, and the pages after a gap are not loaded either.
 */
const PageControlsSchema = z.preprocess(
	(rows) =>
		Object.fromEntries(
			Object.entries(validGridEntries(rows, (row) => !!row && typeof row === 'object')).map(([rowIndex, row]) => [
				rowIndex,
				validGridEntries(row, (controlId) => typeof controlId === 'string'),
			])
		),
	z.record(z.number(), z.record(z.number(), z.string()))
)

/** Lenient for the same reason as its grid. A page without an id is given one when loaded */
export const PageModelSchema = z.object({
	id: z.string().catch(''),
	name: z.string().catch(''),
	controls: PageControlsSchema,
})

export type PageModel = z.output<typeof PageModelSchema>

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

import z from 'zod'

/** A recursive type can't be inferred from its schema, so this is written by hand */
export interface CollectionBase<T> {
	id: string
	label: string
	sortOrder: number
	children: CollectionBase<T>[]
	metaData: T
}

export function createCollectionSchema<T>(metaDataSchema: z.ZodType<T>): z.ZodType<CollectionBase<T>> {
	const schema: z.ZodType<CollectionBase<T>> = z.object({
		id: z.string(),
		label: z.string().default(''),
		sortOrder: z.number().default(0),
		get children() {
			return z.array(schema).default(() => [])
		},
		metaData: metaDataSchema,
	})
	return schema
}

/**
 * Metadata of collections that can be disabled. Collections saved before they could be are enabled.
 * Invalid metadata is replaced rather than failing the collection, which would take its children with it
 */
export const EnabledCollectionDataSchema = z
	.object({
		enabled: z.boolean().default(true),
	})
	.default(() => ({ enabled: true }))
	.catch(() => ({ enabled: true }))

export type EnabledCollectionData = z.output<typeof EnabledCollectionDataSchema>

/** Metadata of collections that have none */
export const EmptyCollectionDataSchema = z.null().default(null).catch(null)

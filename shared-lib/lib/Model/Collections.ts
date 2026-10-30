import z from 'zod'

/** A recursive type can't be inferred from its schema, so this is written by hand */
export interface CollectionBase<T> {
	id: string
	label: string
	sortOrder: number
	children: CollectionBase<T>[]
	metaData: T
}

/**
 * Create the schema of a collection, with the given metadata
 * @param metaDataSchema The schema of the metadata of each collection
 * @param id The name of the schema when it is described as a JSON schema, which must be unique
 */
function createCollectionSchema<T>(metaDataSchema: z.ZodType<T>, id: string): z.ZodType<CollectionBase<T>> {
	const objectSchema = z.object({
		id: z.string(),
		label: z.string().default(''),
		sortOrder: z.number().default(0),
		get children() {
			return z.array(schema).default(() => [])
		},
		metaData: metaDataSchema,
	})
	// The children are of this schema, so they refer to the named schema rather than an anonymous copy of it
	const schema: z.ZodType<CollectionBase<T>> = objectSchema.meta({ id })
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

/** A collection which can be disabled */
export const EnabledCollectionSchema = createCollectionSchema(EnabledCollectionDataSchema, 'EnabledCollection')

/** A collection which has no metadata */
export const EmptyCollectionSchema = createCollectionSchema(EmptyCollectionDataSchema, 'EmptyCollection')

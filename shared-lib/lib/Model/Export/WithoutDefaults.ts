import z from 'zod'

type WithoutDefault<T extends z.ZodType> = T extends z.ZodDefault<infer Inner> ? Inner : T

/**
 * The fields of a db object schema, for a section of an export that the import applies field by field: a missing
 * field is left out, rather than given its default, which would overwrite what is already there. Any catchall isn't
 * kept, so is to be added again
 */
export function withoutDefaults<TShape extends Record<string, z.ZodType>>(
	schema: z.ZodObject<TShape>
): z.ZodObject<{ [K in keyof TShape]: z.ZodOptional<WithoutDefault<TShape[K]>> }> {
	const shape = Object.fromEntries(
		Object.entries(schema.shape).map(([key, field]) => [
			key,
			(field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field).optional(),
		])
	)
	return z.object(shape) as any
}

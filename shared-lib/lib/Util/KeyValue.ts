import z from 'zod'

/** A change to one property of a `T`. Checking `key` narrows `value` to that property's type */
export type KeyValueChange<T> = {
	[K in keyof T]-?: { key: K; value: T[K] }
}[keyof T]

/**
 * The change for one property of a `T`. A `{ key, value }` with a generic key can't be checked against
 * {@link KeyValueChange}, so this is the one place it is asserted
 */
export function keyValueChange<T, K extends keyof T>(key: K, value: T[K]): KeyValueChange<T> {
	return { key, value }
}

/**
 * Checks a {@link KeyValueChange} of an object schema: the key must be one of its properties, and the value valid for
 * it. It is built from the schema, so it checks exactly what the type describes
 */
export function zodKeyValueChange<TSchema extends z.ZodObject>(
	schema: TSchema
): z.ZodType<KeyValueChange<z.output<TSchema>>, KeyValueChange<z.output<TSchema>>> {
	return z.union(
		Object.entries(schema.shape).map(([key, value]) => z.object({ key: z.literal(key), value }))
	) as unknown as z.ZodType<KeyValueChange<z.output<TSchema>>, KeyValueChange<z.output<TSchema>>>
}

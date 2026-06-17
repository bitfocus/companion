import z from 'zod'

/** Pagination metadata in list responses */
export const PaginationMetaSchema = z
	.object({
		total: z.number().describe('Total number of resources available.').meta({ example: 1 }),
		limit: z.number().describe('Maximum number of resources returned by this response.').meta({ example: 100 }),
		offset: z.number().describe('Number of resources skipped before this response.').meta({ example: 0 }),
	})
	.meta({ example: { total: 1, limit: 100, offset: 0 } })

/** Error body schema for OpenAPI docs */
export const ErrorResponseSchema = z
	.object({
		error: z.object({
			code: z.string().describe('Machine-readable error code.').meta({ example: 'unauthorized' }),
			message: z.string().describe('Human-readable error message.').meta({ example: 'Missing bearer token' }),
			details: z.unknown().optional().describe('Additional structured details about the error.'),
		}),
	})
	.meta({ example: { error: { code: 'unauthorized', message: 'Missing bearer token' } } })

/** Create a typed single-item success envelope schema for OpenAPI docs */
export function createSuccessSchema<T extends z.ZodType>(itemSchema: T): z.ZodObject<{ data: T }> {
	const schema = z.object({ data: itemSchema })
	const itemExample = itemSchema.meta()?.example

	return itemExample === undefined ? schema : schema.meta({ example: { data: itemExample } })
}

/** Create a typed collection envelope schema for OpenAPI docs */
export function createCollectionSchema<T extends z.ZodType>(
	itemSchema: T
): z.ZodObject<{ data: z.ZodArray<T>; meta: typeof PaginationMetaSchema }> {
	const schema = z.object({
		data: z.array(itemSchema),
		meta: PaginationMetaSchema,
	})
	const itemExample = itemSchema.meta()?.example
	const metaExample = PaginationMetaSchema.meta()?.example

	return itemExample === undefined ? schema : schema.meta({ example: { data: [itemExample], meta: metaExample } })
}

/** Single-item success response */
export function successResponse<T>(data: T): { data: T } {
	return { data }
}

/** Collection success response with pagination */
export function collectionResponse<T>(
	data: T[],
	meta: { total: number; limit: number; offset: number }
): { data: T[]; meta: { total: number; limit: number; offset: number } } {
	return { data, meta }
}

/** Error response envelope */
export function errorResponse(
	code: string,
	message: string,
	details?: unknown
): { error: { code: string; message: string; details?: unknown } } {
	return {
		error: {
			code,
			message,
			...(details !== undefined ? { details } : {}),
		},
	}
}

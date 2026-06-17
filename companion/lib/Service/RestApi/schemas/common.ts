import z from 'zod'

/** Pagination metadata in list responses */
export const PaginationMetaSchema = z.object({
	total: z.number().describe('Total number of resources available.'),
	limit: z.number().describe('Maximum number of resources returned by this response.'),
	offset: z.number().describe('Number of resources skipped before this response.'),
})

/** Error body schema for OpenAPI docs */
export const ErrorResponseSchema = z.object({
	error: z.object({
		code: z.string().describe('Machine-readable error code.'),
		message: z.string().describe('Human-readable error message.'),
		details: z.unknown().optional().describe('Additional structured details about the error.'),
	}),
})

/** Create a typed single-item success envelope schema for OpenAPI docs */
export function createSuccessSchema<T extends z.ZodType>(itemSchema: T): z.ZodObject<{ data: T }> {
	return z.object({ data: itemSchema })
}

/** Create a typed collection envelope schema for OpenAPI docs */
export function createCollectionSchema<T extends z.ZodType>(
	itemSchema: T
): z.ZodObject<{ data: z.ZodArray<T>; meta: typeof PaginationMetaSchema }> {
	return z.object({
		data: z.array(itemSchema),
		meta: PaginationMetaSchema,
	})
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

import z from 'zod'

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }

export const schemaExpressionOrValue: z.ZodType<ExpressionOrValue<any>> = z.object({
	value: z.any(),
	isExpression: z.boolean(),
})

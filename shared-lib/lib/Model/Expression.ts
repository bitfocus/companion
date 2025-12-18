import z from 'zod'

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }

export const schemaExpressionOrValue: z.ZodType<ExpressionOrValue<any>> = z.object({
	value: z.any(),
	isExpression: z.boolean(),
})

export function isExpressionOrValue<T>(obj: unknown): obj is ExpressionOrValue<T> {
	if (typeof obj !== 'object' || !obj) return false
	if (!('isExpression' in obj) || typeof obj.isExpression !== 'boolean') return false
	if (!('value' in obj)) return false
	if (obj.isExpression) {
		return typeof obj.value === 'string'
	} else {
		return true
	}
}

import type { ControlEntityInstance } from './EntityInstance.js'
import type { StoreResult } from './Types.js'

/**
 * A map of special expression kinds (that is, expressions associated with
 * controls/entities but not found in normal option values) to the computed
 * value of the special expression.
 */
export type SpecialExpressions = {
	isInverted: boolean
	storeResult: StoreResult | undefined
}

/** The possible kinds of special expression. */
export type SpecialExpression = keyof SpecialExpressions

/**
 * A message specifying the new value of a special expression for the given
 * entity/control.
 */
export type NewSpecialExpressionValue<Expression extends SpecialExpression> = {
	readonly entityId: ControlEntityInstance['id']
	readonly controlId: string
	readonly value: SpecialExpressions[Expression]
}

/**
 * A function that handles messages specifying the new values of a particular
 * special expression.
 */
export type UpdateSpecialExpressionValuesFn<Expression extends SpecialExpression> = (
	newValues: ReadonlyMap<string, NewSpecialExpressionValue<Expression>>
) => void

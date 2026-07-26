import type { VariableValue } from './Model/Variables.js'

export type ExecuteExpressionResult = ExecuteExpressionResultOk | ExecuteExpressionResultError
export interface ExecuteExpressionResultOk {
	ok: true
	value: VariableValue | undefined
	variableIds: ReadonlySet<string>
	/** Whether this result depends on the render clock (e.g. oscillate() was called) */
	clockSensitive: boolean
}
export interface ExecuteExpressionResultError {
	ok: false
	error: string
	variableIds: ReadonlySet<string>
	/** Whether this result depends on the render clock (e.g. oscillate() was called) */
	clockSensitive: boolean
}

export type ExpressionStreamResult = ExpressionStreamResultOk | ExpressionStreamResultError
export interface ExpressionStreamResultOk {
	ok: true
	value: VariableValue | undefined
	// variableIds: Set<string>
}
export interface ExpressionStreamResultError {
	ok: false
	error: string
	// variableIds: Set<string>
}

export interface ParseVariablesResult {
	text: string
	variableIds: ReadonlySet<string>
}

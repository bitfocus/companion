import type { VariableValue } from '../Model/Variables.js'

export type ExecuteExpressionResult = ExecuteExpressionResultOk | ExecuteExpressionResultError
export interface ExecuteExpressionResultOk {
	ok: true
	value: VariableValue | undefined
	variableIds: ReadonlySet<string>
}
export interface ExecuteExpressionResultError {
	ok: false
	error: string
	variableIds: ReadonlySet<string>
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

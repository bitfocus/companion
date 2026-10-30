import type { VariableValue } from './Model/Variables.js'

export type ExecuteExpressionResult = ExecuteExpressionResultOk | ExecuteExpressionResultError
export interface ExecuteExpressionResultOk {
	ok: true
	value: VariableValue | undefined
	variableIds: ReadonlySet<string>
	/**
	 * How long until everything in this result which depends on the render clock (e.g. oscillate()) repeats,
	 * in ms, or 0 if it doesn't depend on the render clock
	 */
	clockCycleMs: number
}
export interface ExecuteExpressionResultError {
	ok: false
	error: string
	variableIds: ReadonlySet<string>
	/** How long until this result repeats, as for {@link ExecuteExpressionResultOk.clockCycleMs} */
	clockCycleMs: number
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

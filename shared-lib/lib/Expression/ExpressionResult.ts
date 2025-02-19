export type ExecuteExpressionResult = ExecuteExpressionResultOk | ExecuteExpressionResultError
export interface ExecuteExpressionResultOk {
	ok: true
	value: boolean | number | string | undefined
	variableIds: Set<string>
}
export interface ExecuteExpressionResultError {
	ok: false
	error: string
	variableIds: Set<string>
}

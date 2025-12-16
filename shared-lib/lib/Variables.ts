export const VARIABLE_UNKNOWN_VALUE = '$NA'

export function SplitVariableId(variableId: string): [string, string] {
	const res = TrySplitVariableId(variableId)
	if (res === null) throw new Error(`"${variableId}" is not a valid variable id`)
	return res
}

export function TrySplitVariableId(variableId: string): [string, string] | null {
	if (!variableId) return null
	const splitIndex = variableId.indexOf(':')
	if (splitIndex === -1) return null

	const label = variableId.substring(0, splitIndex)
	const variable = variableId.substring(splitIndex + 1)

	return [label, variable]
}

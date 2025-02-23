export type SomeLocalVariableDefinition = LocalExpressionVariableDefinition // TODO - more variants

export interface LocalVariableDefinitionBase {
	name: string
	description: string
	sortOrder: number
}

export interface LocalExpressionVariableDefinition extends LocalVariableDefinitionBase {
	type: 'expression'
	expression: string
}

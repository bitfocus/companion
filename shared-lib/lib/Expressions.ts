import {
	ResolveExpression as ResolveExpressionRaw,
	type ResolveExpressionOptions as ResolveExpressionOptionsRaw,
	type SomeExpressionNode,
} from '@companion-app/expressions'
import type { Complete } from '@companion-module/base'
import type { VariableValue } from './Model/Variables.js'
import { SplitVariableId, VARIABLE_UNKNOWN_VALUE } from './Variables.js'

export { ParseExpression, BANNED_PROPS } from '@companion-app/expressions'

export interface GetVariableValueProps {
	variableId: string
	label: string
	name: string
}

export type ResolveExpressionLimits = Pick<ResolveExpressionOptionsRaw, 'maxOperations' | 'maxCallDepth'>

export type ResolveExpressionOptions = Complete<
	Pick<ResolveExpressionOptionsRaw, 'parseVariables' | 'blink' | 'defaultTimezone'>
> & {
	getVariableValue: (props: GetVariableValueProps) => VariableValue | undefined
} & ResolveExpressionLimits

export function ResolveExpression(
	node: SomeExpressionNode,
	options: ResolveExpressionOptions
): VariableValue | undefined {
	return ResolveExpressionRaw(node, {
		maxCallDepth: undefined,
		maxOperations: undefined,

		...options,

		getVariableValue: (variableIdOrLabel: string, nameOrUndefined?: string) => {
			if (nameOrUndefined !== undefined) {
				return options.getVariableValue({
					variableId: `${variableIdOrLabel}:${nameOrUndefined}`,
					label: variableIdOrLabel,
					name: nameOrUndefined,
				})
			} else {
				const [label, name] = SplitVariableId(variableIdOrLabel)

				return options.getVariableValue({ variableId: variableIdOrLabel, label, name })
			}
		},

		// Defaults
		unknownVariableValue: VARIABLE_UNKNOWN_VALUE,
		processTemplateEscapes: false,
		stringConcatenation: false,
	} satisfies Complete<ResolveExpressionOptionsRaw>)
}

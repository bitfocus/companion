import type {
	ButtonStyleProperties,
	DrawStyleButtonModel,
	DrawStyleButtonStateProps,
} from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionVariableValues } from '@companion-module/base'
import type { Logger } from '../../../Log/Controller.js'
import { cloneDeep, omit } from 'lodash-es'
import type { ControlDependencies } from '../../ControlDependencies.js'
import type { ControlEntityListPoolButton } from '../../Entities/EntityListPoolButton.js'

export function composeDrawStyle(
	logger: Logger,
	controlId: string,
	deps: ControlDependencies,
	entities: ControlEntityListPoolButton,
	baseStyle: ButtonStyleProperties,
	stateProps: DrawStyleButtonStateProps
): {
	style: DrawStyleButtonModel
	variables: ReadonlySet<string> | null
} {
	const style = entities.getUnparsedFeedbackStyle(baseStyle)

	let referencedVariables: ReadonlySet<string> | null = null

	if (style.text) {
		// Block out the button text
		const overrideVariableValues: CompanionVariableValues = {}

		const location = deps.pageStore.getLocationOfControlId(controlId)
		if (location) {
			// Ensure we don't enter into an infinite loop
			overrideVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
		}

		// Setup the parser
		const parser = deps.variables.values.createVariablesAndExpressionParser(
			location,
			entities.getLocalVariableEntities(),
			overrideVariableValues
		)

		if (style.textExpression) {
			const parseResult = parser.executeExpression(style.text, undefined)
			if (parseResult.ok) {
				style.text = parseResult.value + ''
			} else {
				logger.error(`Expression parse error: ${parseResult.error}`)
				style.text = 'ERR'
			}
			referencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
		} else {
			const parseResult = parser.parseVariables(style.text)
			style.text = parseResult.text
			referencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
		}
	}

	const drawStyle: DrawStyleButtonModel = {
		cloud: false,
		cloud_error: false,

		...cloneDeep(style),

		...omit(stateProps, ['cloud', 'cloud_error']),

		style: 'button',
	}

	return {
		style: drawStyle,
		variables: referencedVariables,
	}
}

import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'

const commonOptions: (InternalActionInputField | InternalFeedbackInputField)[] = [
	{
		id: 'name',
		label: 'Name',
		type: 'textinput',
		default: 'var0',
		// regex: '/^([\w-_]+):([a-zA-Z0-9-_\.]+)$/',
		tooltip: 'The name of the variable. You must make sure this is unique on this control.',
	},
]

export const LocalVariableEntityDefinitions: Record<string, ClientEntityDefinition> = {
	'dynamic-expression': {
		entityType: EntityModelType.LocalVariable,
		label: 'Dynamic Expression',
		description: 'A dynamic expression that can be used in other fields',
		options: [
			...commonOptions,
			{
				id: 'expression',
				label: 'Expression',
				type: 'textinput',
				default: '$(internal:time_hms)',
				isExpression: true,
				useVariables: {
					local: true,
				},
			},
		],
		feedbackType: null,
		feedbackStyle: undefined,
		hasLearn: false,
		learnTimeout: undefined,
		showInvert: false,
		showButtonPreview: false,
		supportsChildGroups: [],
	},
}

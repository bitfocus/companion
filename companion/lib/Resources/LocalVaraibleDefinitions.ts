import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

export const LocalVariableEntityDefinitions: Record<string, ClientEntityDefinition> = {
	// TODO
	'dynamic-expression': {
		entityType: EntityModelType.LocalVariable,
		label: 'Dynamic Expression',
		description: 'A dynamic expression that can be used in other fields',
		options: [
			{
				id: 'name',
				label: 'Name',
				type: 'textinput',
				default: 'var0',
				// regex: '/^([\w-_]+):([a-zA-Z0-9-_\.]+)$/',
			},
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

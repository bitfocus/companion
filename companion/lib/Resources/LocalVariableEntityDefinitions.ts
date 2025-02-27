import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'

export enum LocalVariableEntityDefinitionType {
	ConstantValue = 'constant-value',
	DynamicExpression = 'dynamic-expression',
	Feedbacks = 'feedbacks',
}

const commonOptions: (InternalActionInputField | InternalFeedbackInputField)[] = [
	{
		id: 'name',
		label: 'Name',
		type: 'textinput',
		default: 'var0',
		// regex: '/^([\w-_]+):([a-zA-Z0-9-_\.]+)$/',
		tooltip: 'The name of the variable. You must make sure this is unique on this control.',
	},
	{
		id: 'description',
		label: 'Description',
		type: 'textinput',
		default: '',
		tooltip: 'A description of the variable',
	},
]

export const LocalVariableEntityDefinitions: Record<LocalVariableEntityDefinitionType, ClientEntityDefinition> = {
	[LocalVariableEntityDefinitionType.ConstantValue]: {
		entityType: EntityModelType.LocalVariable,
		label: 'Constant Value',
		description: 'A constant value that can be used in other fields',
		options: [
			...commonOptions,
			{
				id: 'value',
				label: 'Value',
				type: 'textinput',
				default: '1',
				isExpression: false,
				// useVariables: {
				// 	local: true,
				// },
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
	[LocalVariableEntityDefinitionType.DynamicExpression]: {
		entityType: EntityModelType.LocalVariable,
		label: 'Reusable Expression',
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
	[LocalVariableEntityDefinitionType.Feedbacks]: {
		entityType: EntityModelType.LocalVariable,
		label: 'Boolean Feedbacks',
		description: 'A value defined by boolean feedbacks',
		options: [...commonOptions],
		feedbackType: null,
		feedbackStyle: undefined,
		hasLearn: false,
		learnTimeout: undefined,
		showInvert: false,
		showButtonPreview: false,
		supportsChildGroups: [
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				entityTypeLabel: 'feedback',
				label: 'Feedbacks',
				// hint?: string

				feedbackListType: FeedbackEntitySubType.Boolean,
			},
		],
	},
}

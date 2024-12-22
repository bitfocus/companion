import type { EntityModelType, EntitySupportedChildGroupDefinition } from './EntityModel.js'
import type { InternalActionInputField, InternalFeedbackInputField } from './Options.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'

export interface ClientEntityDefinition {
	entityType: EntityModelType
	label: string
	description: string | undefined
	options: (InternalActionInputField | InternalFeedbackInputField)[]
	feedbackType: 'advanced' | 'boolean' | null
	feedbackStyle: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean

	showButtonPreview: boolean
	supportsChildGroups: EntitySupportedChildGroupDefinition[]
}

import type { EntityModelType, EntitySupportedChildGroupDefinition, FeedbackEntitySubType } from './EntityModel.js'
import type { SomeCompanionInputField } from './Options.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { ObjectsDiff } from './Common.js'

export interface ClientEntityDefinition {
	entityType: EntityModelType
	label: string
	description: string | undefined
	options: SomeCompanionInputField[]
	/**
	 * The options that should be monitored for triggering invalidations
	 * If null, all options are monitored
	 */
	optionsToMonitorForInvalidations: string[] | null
	feedbackType: FeedbackEntitySubType | null
	feedbackStyle: Partial<CompanionButtonStyleProps> | undefined
	hasLifecycleFunctions: boolean
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean

	/**
	 * Whether this entity definition uses the auto-parser for options
	 */
	optionsSupportExpressions: boolean

	/**
	 * Whether this entity supports button previewing a reference in the UI
	 * Note: This is only valid for internal connections. It expects to find a 'location' option to preview
	 */
	showButtonPreview: boolean
	/**
	 * Whether this entity supports child groups, and if so, details about them
	 * Note: This is only valid for internal connections
	 */
	supportsChildGroups: EntitySupportedChildGroupDefinition[]
}

export type EntityDefinitionUpdate =
	| EntityDefinitionUpdateInit
	| EntityDefinitionUpdateForgetConnection
	| EntityDefinitionUpdateAddConnection
	| EntityDefinitionUpdateUpdateConnection

export interface EntityDefinitionUpdateInit {
	type: 'init'
	definitions: Record<string, Record<string, ClientEntityDefinition>>
}
export interface EntityDefinitionUpdateForgetConnection {
	type: 'forget-connection'
	connectionId: string
}
export interface EntityDefinitionUpdateAddConnection {
	type: 'add-connection'
	connectionId: string

	entities: Record<string, ClientEntityDefinition | undefined>
}
export interface EntityDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientEntityDefinition> {
	type: 'update-connection'
	connectionId: string
}

import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { ObjectsDiff } from './Common.js'
import type { EntityModelType, EntitySupportedChildGroupDefinition, FeedbackEntitySubType } from './EntityModel.js'
import type { SomeCompanionInputField } from './Options.js'

/**
 * An output of an action, which the action can be told where to write
 */
export interface ClientEntityOutputDefinition {
	id: string
	label: string
}

export interface ClientEntityDefinition {
	entityType: EntityModelType
	label: string
	sortKey: string | null
	description: string | undefined
	options: SomeCompanionInputField[]
	/**
	 * The options that should be monitored for triggering invalidations
	 * If null, all options are monitored
	 */
	optionsToMonitorForInvalidations: string[] | null
	feedbackType: FeedbackEntitySubType | null
	feedbackStyle: Partial<CompanionButtonStyleProps> | undefined
	/**
	 * Special case for 'conditionalise existing feedbacks' to avoid the root getting style overrides, as we defer that to the children feedbacks
	 */
	feedbackDisableStyleOverrides?: boolean
	/** When true, this entity is never offered for adding, as it only stands in for one that couldn't be loaded. Defaults to false */
	hiddenFromPicker?: boolean
	/** When true, this feedback cannot be used as a style override: it is hidden from the add menu and rejected by validation. */
	feedbackStyleOverridesUnsupported?: boolean
	hasLifecycleFunctions: boolean
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean

	/**
	 * When an action, whether the action specifies that its callback returns a
	 * `JsonValue` result.
	 */
	actionHasResult: boolean | undefined

	/**
	 * When an action which runs a custom action, its outputs. Each can be written to a target chosen on the action
	 */
	actionOutputs: ClientEntityOutputDefinition[] | null

	/**
	 * Why the entity won't do all it says, such as a custom action which calls back into itself, to show the user.
	 * Null when there is nothing wrong
	 */
	warning: string | null

	/**
	 * When an advanced feedback, the properties that should have overrides assigned
	 */
	feedbackAffectedProperties: string[] | undefined

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

export interface UICompositeElementDefinition {
	name: string
	sortKey: string | null
	description?: string
	options: SomeCompanionInputField[]
}

export interface CompositeElementDefinitionInit {
	type: 'init'
	definitions: Record<string, Record<string, UICompositeElementDefinition>>
}

export interface CompositeElementDefinitionForgetConnection {
	type: 'forget-connection'
	connectionId: string
}

export interface CompositeElementDefinitionAddConnection {
	type: 'add-connection'
	connectionId: string
	definitions: Record<string, UICompositeElementDefinition>
}

export interface CompositeElementDefinitionUpdateConnection extends ObjectsDiff<UICompositeElementDefinition> {
	type: 'update-connection'
	connectionId: string
}

export type CompositeElementDefinitionUpdate =
	| CompositeElementDefinitionInit
	| CompositeElementDefinitionForgetConnection
	| CompositeElementDefinitionAddConnection
	| CompositeElementDefinitionUpdateConnection

import type { ControlIdKind } from '../ControlId.js'
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

/**
 * What the definitions of actions and feedbacks have in common, as the ui needs it
 */
export interface ClientEntityDefinitionBase {
	label: string
	sortKey: string | null
	description: string | undefined
	options: SomeCompanionInputField[]
	/** When true, this entity is never offered for adding, as it only stands in for one that couldn't be loaded. Defaults to false */
	hiddenFromPicker?: boolean
	/** Never offered for adding to a control of these types; existing ones still work. Defaults to none */
	hiddenForControlTypes?: ControlIdKind[]
	hasLearn: boolean

	/**
	 * Why the entity won't do all it says, such as a custom action which calls back into itself, to show the user.
	 * Null when there is nothing wrong
	 */
	warning: string | null

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

/**
 * The definition of an action, as the ui needs it. The backend holds more about each, in `ActionDefinition`
 */
export interface ClientActionDefinition extends ClientEntityDefinitionBase {
	entityType: EntityModelType.Action

	/**
	 * Whether the action specifies that its callback returns a `JsonValue` result.
	 */
	actionHasResult: boolean

	/**
	 * When an action which runs a custom action, its outputs. Each can be written to a target chosen on the action
	 */
	actionOutputs: ClientEntityOutputDefinition[] | null
}

/**
 * The definition of a feedback, as the ui needs it. The backend holds more about each, in `FeedbackDefinition`
 */
export interface ClientFeedbackDefinition extends ClientEntityDefinitionBase {
	entityType: EntityModelType.Feedback
	feedbackType: FeedbackEntitySubType
	/**
	 * Special case for 'conditionalise existing feedbacks' to avoid the root getting style overrides, as we defer that to the children feedbacks
	 */
	feedbackDisableStyleOverrides?: boolean
	/** When true, this feedback cannot be used as a style override: it is hidden from the add menu and rejected by validation. */
	feedbackStyleOverridesUnsupported?: boolean
	showInvert: boolean
	/** When true, the invert option can't be an expression, as the module applies it. Defaults to false */
	invertDisableAutoExpression?: boolean
}

export type ClientEntityDefinition = ClientActionDefinition | ClientFeedbackDefinition

export type EntityDefinitionUpdate<TDefinition extends ClientEntityDefinition> =
	| EntityDefinitionUpdateInit<TDefinition>
	| EntityDefinitionUpdateForgetConnection
	| EntityDefinitionUpdateAddConnection<TDefinition>
	| EntityDefinitionUpdateUpdateConnection<TDefinition>

export interface EntityDefinitionUpdateInit<TDefinition extends ClientEntityDefinition> {
	type: 'init'
	definitions: Record<string, Record<string, TDefinition>>
}
export interface EntityDefinitionUpdateForgetConnection {
	type: 'forget-connection'
	connectionId: string
}
export interface EntityDefinitionUpdateAddConnection<TDefinition extends ClientEntityDefinition> {
	type: 'add-connection'
	connectionId: string

	entities: Record<string, TDefinition | undefined>
}
export interface EntityDefinitionUpdateUpdateConnection<
	TDefinition extends ClientEntityDefinition,
> extends ObjectsDiff<TDefinition> {
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

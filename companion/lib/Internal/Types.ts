import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { VisitorReferencesCollectorVisitor } from '../Resources/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdaterVisitor } from '../Resources/Visitors/ReferencesUpdater.js'
import type {
	CompanionFeedbackButtonStyleResult,
	CompanionOptionValues,
	CompanionVariableValue,
} from '@companion-module/base'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { SetOptional } from 'type-fest'
import type { ActionEntityModel, FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { EventEmitter } from 'events'
import type { OptionsObject } from '@companion-module/base/dist/util.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'

export interface FeedbackForInternalExecution {
	controlId: string
	location: ControlLocation | undefined

	id: string
	definitionId: string

	options: OptionsObject
}

export interface ActionForInternalExecution {
	// controlId: string
	// location: ControlLocation | undefined

	id: string
	definitionId: string

	options: OptionsObject

	rawEntity: ControlEntityInstance
}

export type InternalVisitor = VisitorReferencesCollectorVisitor | VisitorReferencesUpdaterVisitor

/**
 * A minimal representation of a feedback, for visiting internal feedbacks.
 */
export interface FeedbackForVisitor {
	id: string
	type: string
	options: CompanionOptionValues
}

/**
 * A minimal representation of a action, for visiting internal actions.
 */
export interface ActionForVisitor {
	id: string
	action: string
	options: CompanionOptionValues
}

export interface InternalModuleFragmentEvents {
	checkFeedbacks: [...feedbackType: string[]]
	checkFeedbacksById: [...feedbackIds: string[]]
	regenerateVariables: []
	setVariables: [variables: Record<string, CompanionVariableValue | undefined>]
}

export interface InternalModuleFragment extends EventEmitter<InternalModuleFragmentEvents> {
	getActionDefinitions?: () => Record<string, InternalActionDefinition>

	/**
	 * Run a single internal action
	 * @returns Whether the action was handled
	 */
	executeAction?(
		action: ActionForInternalExecution,
		extras: RunActionExtras,
		actionRunner: ActionRunner,
		parser: VariablesAndExpressionParser
	): Promise<boolean> | boolean

	/**
	 * Perform an upgrade for an action
	 * @returns Updated action if any changes were made
	 */
	actionUpgrade?: (action: ActionEntityModel, controlId: string) => ActionEntityModel | void

	getFeedbackDefinitions?: () => Record<string, InternalFeedbackDefinition>

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback?: (
		feedback: FeedbackForInternalExecution,
		parser: VariablesAndExpressionParser
	) => CompanionFeedbackButtonStyleResult | boolean | ExecuteFeedbackResultWithReferences | void

	feedbackUpgrade?: (feedback: FeedbackEntityModel, controlId: string) => FeedbackEntityModel | void

	forgetFeedback?: (feedback: FeedbackEntityModel) => void

	/**
	 *
	 */
	visitReferences(visitor: InternalVisitor, actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void

	getVariableDefinitions?: () => VariableDefinitionTmp[]
	updateVariables?: () => void
}

export interface ExecuteFeedbackResultWithReferences {
	referencedVariables: string[]
	value: CompanionFeedbackButtonStyleResult | CompanionVariableValue | undefined
}

export type InternalActionDefinition = SetOptional<
	Omit<
		ClientEntityDefinition,
		'entityType' | 'showInvert' | 'feedbackType' | 'feedbackStyle' | 'hasLifecycleFunctions'
	>,
	| 'hasLearn'
	| 'learnTimeout'
	| 'showButtonPreview'
	| 'supportsChildGroups'
	| 'optionsToIgnoreForSubscribe'
	| 'internalUsesAutoParser'
>

export type InternalFeedbackDefinition = SetOptional<
	Omit<ClientEntityDefinition, 'entityType' | 'hasLifecycleFunctions' | 'optionsToIgnoreForSubscribe'>,
	'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildGroups' | 'internalUsesAutoParser'
>

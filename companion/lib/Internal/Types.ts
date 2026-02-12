import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { VisitorReferencesCollectorVisitor } from '../Resources/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdaterVisitor } from '../Resources/Visitors/ReferencesUpdater.js'
import type { CompanionFeedbackButtonStyleResult, CompanionOptionValues } from '@companion-module/base'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { SetOptional } from 'type-fest'
import type { ActionEntityModel, FeedbackEntityModel, FeedbackValue } from '@companion-app/shared/Model/EntityModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { ActionRunner } from '../Controls/ActionRunner.js'
import type { EventEmitter } from 'events'
import type { VariableDefinition, VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'

export interface FeedbackForInternalExecution {
	controlId: string
	location: ControlLocation | undefined

	id: string
	definitionId: string

	options: CompanionOptionValues
}

export interface ActionForInternalExecution {
	// controlId: string
	// location: ControlLocation | undefined

	id: string
	definitionId: string

	options: CompanionOptionValues

	rawEntity: ControlEntityInstance
}

export type InternalVisitor = VisitorReferencesCollectorVisitor | VisitorReferencesUpdaterVisitor

/**
 * A minimal representation of a feedback, for visiting internal feedbacks.
 */
export interface FeedbackForVisitor {
	id: string
	type: string
	options: ExpressionableOptionsObject
}

/**
 * A minimal representation of a action, for visiting internal actions.
 */
export interface ActionForVisitor {
	id: string
	action: string
	options: ExpressionableOptionsObject
}

export interface InternalModuleFragmentEvents {
	checkFeedbacks: [...feedbackType: string[]]
	checkFeedbacksById: [...feedbackIds: string[]]
	regenerateVariables: []
	setVariables: [variables: Record<string, VariableValue | undefined>]
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

	getVariableDefinitions?: () => VariableDefinition[]
	updateVariables?: () => void
}

export interface ExecuteFeedbackResultWithReferences {
	referencedVariables: Iterable<string>
	value: FeedbackValue | undefined
}

export type InternalActionDefinition = SetOptional<
	Omit<
		ClientEntityDefinition,
		'entityType' | 'showInvert' | 'feedbackType' | 'feedbackStyle' | 'hasLifecycleFunctions'
	>,
	| 'sortKey'
	| 'hasLearn'
	| 'learnTimeout'
	| 'showButtonPreview'
	| 'supportsChildGroups'
	| 'optionsToMonitorForInvalidations'
>

export type InternalFeedbackDefinition = SetOptional<
	Omit<ClientEntityDefinition, 'entityType' | 'hasLifecycleFunctions' | 'optionsToMonitorForInvalidations'>,
	'sortKey' | 'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildGroups'
>

import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { VisitorReferencesCollector } from '../Resources/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import type { CompanionFeedbackButtonStyleResult, CompanionOptionValues } from '@companion-module/base'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import type { SetOptional } from 'type-fest'
import type { ActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'

export interface FeedbackInstanceExt extends FeedbackInstance {
	controlId: string
	location: ControlLocation | undefined
	referencedVariables: string[] | null
}

export type InternalVisitor = VisitorReferencesCollector | VisitorReferencesUpdater

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

export interface InternalModuleFragment {
	getActionDefinitions?: () => Record<string, InternalActionDefinition>

	/**
	 * Run a single internal action
	 * @returns Whether the action was handled
	 */
	executeAction?(action: ActionInstance, extras: RunActionExtras): Promise<boolean> | boolean

	/**
	 * Perform an upgrade for an action
	 * @returns Updated action if any changes were made
	 */
	actionUpgrade?: (action: ActionInstance, _controlId: string) => ActionInstance | void

	getFeedbackDefinitions?: () => Record<string, InternalFeedbackDefinition>

	/**
	 * Get an updated value for a feedback
	 */
	executeFeedback?: (
		feedback: FeedbackInstanceExt
	) => CompanionFeedbackButtonStyleResult | boolean | ExecuteFeedbackResultWithReferences | void

	feedbackUpgrade?: (feedback: FeedbackInstance, _controlId: string) => FeedbackInstance | void

	/**
	 *
	 */
	visitReferences(visitor: InternalVisitor, actions: ActionForVisitor[], feedbacks: FeedbackForVisitor[]): void

	getVariableDefinitions?: () => VariableDefinitionTmp[]
	updateVariables?: () => void
}

export interface ExecuteFeedbackResultWithReferences {
	referencedVariables: string[]
	value: any
}

export type InternalActionDefinition = SetOptional<
	ActionDefinition,
	'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildActionGroups'
>

export type InternalFeedbackDefinition = SetOptional<
	FeedbackDefinition,
	'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildFeedbacks'
>

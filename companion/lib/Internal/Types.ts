import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { VisitorReferencesCollector } from '../Resources/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdater } from '../Resources/Visitors/ReferencesUpdater.js'
import type { CompanionFeedbackButtonStyleResult, CompanionOptionValues } from '@companion-module/base'
import type { RunActionExtras, VariableDefinitionTmp } from '../Instance/Wrapper.js'
import type { SetOptional } from 'type-fest'
import type { ActionEntityModel, FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

export interface FeedbackEntityModelExt extends FeedbackEntityModel {
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
	executeAction?(action: ActionEntityModel, extras: RunActionExtras): Promise<boolean> | boolean

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
		feedback: FeedbackEntityModelExt
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
	value: any
}

export type InternalActionDefinition = SetOptional<
	Omit<ClientEntityDefinition, 'entityType' | 'showInvert' | 'feedbackType' | 'feedbackStyle'>,
	'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildGroups'
>

export type InternalFeedbackDefinition = SetOptional<
	Omit<ClientEntityDefinition, 'entityType'>,
	'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildGroups'
>

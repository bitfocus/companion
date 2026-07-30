import type { EventEmitter } from 'node:events'
import type { SetOptional } from 'type-fest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { ActionEntityModel, FeedbackEntityModel, FeedbackValue } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { VariableDefinition, VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { CompanionFeedbackButtonStyleResult, CompanionOptionValues } from '@companion-module/base'
import type { JsonValue } from '@companion-module/host'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { VisitorReferencesCollectorVisitor } from '../Resources/Visitors/ReferencesCollector.js'
import type { VisitorReferencesUpdaterVisitor } from '../Resources/Visitors/ReferencesUpdater.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'

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

/**
 * Context for lazily evaluating an internal feedback that is a child of an action.
 *
 * Internal feedbacks which live inside an action subtree (e.g. the `condition` of `logic_if`/`logic_while`)
 * are not eagerly cached. Instead they are evaluated live at action-execution time, using the parser
 * carried here. That parser already reflects the control's current variable state plus the extra
 * `$(this:*)` overrides derived from the running action's execution context, so those execution-derived
 * variables are visible to the feedback's options.
 *
 * A `null` context anywhere in the feedback read path means "use the cached value" - the eager path used
 * by the feedbacks/local-variables lists and by all module-owned feedbacks.
 */
export interface FeedbackExecutionContext {
	readonly parser: VariablesAndExpressionParser
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

/**
 * Executing an internal action using an internal module fragment returns this
 * if it handled the action.  The embedded result is the result of the action.
 * (Note that the action definition must specify that it returns a result using
 * `hasResult: true`, or the result will be ignored.)
 */
export type ActionResult = { result: JsonValue | undefined }

/**
 * The result of asking an internal module fragment to execute an action.
 *
 * If the fragment doesn't handle the action, this will be `null`.  Otherwise
 * the result returned by the action will be stored in the `result` property.
 */
export type InternalActionResult = ActionResult | null

export interface InternalModuleFragment extends EventEmitter<InternalModuleFragmentEvents> {
	getActionDefinitions?: () => Record<string, InternalActionDefinition>

	/**
	 * Run a single internal action
	 * @param createFeedbackContext Factory for a {@link FeedbackExecutionContext}, used to lazily evaluate
	 * any internal feedbacks which are children of this action. Each call builds a fresh parser reflecting
	 * the current variable state, so callers that re-check conditions (e.g. `logic_while`) must call it
	 * again for each evaluation.
	 * @returns Whether the action was handled
	 */
	executeAction?(
		action: ActionForInternalExecution,
		extras: RunActionExtras,
		parser: VariablesAndExpressionParser,
		createFeedbackContext: () => FeedbackExecutionContext
	): Promise<InternalActionResult> | InternalActionResult

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
		| 'entityType'
		| 'showInvert'
		| 'feedbackType'
		| 'feedbackStyle'
		| 'hasLifecycleFunctions'
		| 'feedbackAffectedProperties'
	>,
	| 'sortKey'
	| 'hasLearn'
	| 'learnTimeout'
	| 'actionHasResult'
	| 'showButtonPreview'
	| 'supportsChildGroups'
	| 'optionsToMonitorForInvalidations'
>

export type InternalFeedbackDefinition = SetOptional<
	Omit<
		ClientEntityDefinition,
		'entityType' | 'hasLifecycleFunctions' | 'optionsToMonitorForInvalidations' | 'actionHasResult'
	>,
	'sortKey' | 'hasLearn' | 'learnTimeout' | 'showButtonPreview' | 'supportsChildGroups' | 'feedbackAffectedProperties'
>

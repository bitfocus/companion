import { EventEmitter } from 'node:events'
import { FeedbackEntitySubType, INVALID_ENTITY_DEFINITION_ID } from '@companion-app/shared/Model/EntityModel.js'
import type {
	ActionForInternalExecution,
	FeedbackForInternalExecution,
	InternalActionDefinition,
	InternalActionResult,
	InternalFeedbackDefinition,
	InternalModuleFragment,
	InternalModuleFragmentEvents,
} from './Types.js'

const description =
	"This couldn't be loaded, so has been replaced to show where it was. It never runs, and the original is kept in its options, to be recovered"

/**
 * The placeholder that replaces an entity which couldn't be loaded. It is never offered for adding, and does nothing
 */
export class InternalInvalidEntity
	extends EventEmitter<InternalModuleFragmentEvents>
	implements InternalModuleFragment
{
	getActionDefinitions(): Record<string, InternalActionDefinition> {
		return {
			[INVALID_ENTITY_DEFINITION_ID]: {
				label: "Action that couldn't be loaded",
				description,
				options: [],
				hiddenFromPicker: true,
				optionsSupportExpressions: false,
			},
		}
	}

	executeAction(action: ActionForInternalExecution): InternalActionResult {
		if (action.definitionId !== INVALID_ENTITY_DEFINITION_ID) return null
		return { result: undefined }
	}

	getFeedbackDefinitions(): Record<string, InternalFeedbackDefinition> {
		return {
			[INVALID_ENTITY_DEFINITION_ID]: {
				feedbackType: FeedbackEntitySubType.Boolean,
				label: "Feedback that couldn't be loaded",
				description,
				feedbackStyle: undefined,
				showInvert: false,
				options: [],
				hiddenFromPicker: true,
				optionsSupportExpressions: false,
			},
		}
	}

	executeFeedback(feedback: FeedbackForInternalExecution): boolean | void {
		if (feedback.definitionId !== INVALID_ENTITY_DEFINITION_ID) return
		return false
	}
}
